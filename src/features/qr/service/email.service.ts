import nodemailer, { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import dns from 'node:dns/promises';
import net from 'node:net';

// SMTP is configured entirely through env vars so it can point at ANY server —
// a locally hosted SMTP (Postfix/MailHog), a company relay, or a provider.
// There is no artificial per-day cap in this code; limits, if any, come from
// whichever server SMTP_HOST points to.
//
// IMPORTANT: env vars are read LAZILY (inside functions), not at module load.
// server.ts imports this module before it calls dotenv.config(), so reading
// process.env at the top level would capture undefined values.
const getConfig = () => ({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true', // true => port 465
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM || 'TEDxIIT Patna <no-reply@tedx.com>',
});

// Email is optional. If no host is configured we simply skip sending so ticket
// generation keeps working in environments without SMTP set up.
export const isEmailConfigured = (): boolean => Boolean(process.env.SMTP_HOST);

let transporter: Transporter | null = null;

const getTransporter = async (): Promise<Transporter> => {
  if (transporter) return transporter;

  const cfg = getConfig();

  // Resolve the SMTP host to an IPv4 address OURSELVES and connect by IP.
  // Many cloud hosts (Render, etc.) have no routable IPv6, yet smtp.gmail.com
  // advertises an AAAA record — letting the SMTP client pick it causes
  // `connect ENETUNREACH 2404:6800:...:465`. nodemailer's own `family: 4`
  // option does not reliably steer its hostname resolution, so we do the A
  // lookup here and pass the literal IPv4. The original hostname is kept as the
  // TLS servername so Gmail's certificate still validates.
  let host = (cfg.host || '') as string;
  let servername: string | undefined;
  if (host && !net.isIP(host)) {
    try {
      const { address } = await dns.lookup(host, { family: 4 });
      servername = host;
      host = address;
    } catch {
      // DNS failed — fall back to the hostname and let nodemailer resolve it.
    }
  }

  const options = {
    host,
    port: cfg.port,
    secure: cfg.secure,
    family: 4,
    // When we connected by IP, validate TLS against the real hostname.
    ...(servername ? { tls: { servername }, name: servername } : {}),
    // Auth is optional — a local relay may accept mail without credentials.
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    // Fail fast instead of hanging on nodemailer's ~2-minute default. Many hosts
    // (e.g. Render free tier) block/throttle outbound SMTP; without these the
    // awaited send blocks the HTTP response until the platform resets the
    // connection, surfacing on the client as "Cannot reach the server". With
    // them, a dead SMTP errors in seconds and ticket generation still succeeds
    // (tryEmailTicket catches it and reports emailSent: false).
    connectionTimeout: 10_000, // TCP connect
    greetingTimeout: 10_000,   // wait for server 220 greeting
    socketTimeout: 15_000,     // inactivity once connected
    // Reuse connections instead of a fresh TCP+TLS+AUTH handshake per message,
    // and let nodemailer enforce the send rate rather than a fixed sleep.
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: 60_000,
    rateLimit: 40,
  } as SMTPTransport.Options;

  transporter = nodemailer.createTransport(options);

  return transporter;
};

interface TicketEmailInput {
  to: string;
  name?: string;
  ticketId: string;
  session: 'SESSION_1' | 'SESSION_2';
  qrDataUrl: string; // data:image/png;base64,....
}

const prettySession = (session: string) =>
  session === 'SESSION_1' ? 'Session 1' : 'Session 2';

const getSessionNumber = (session: string) => session === 'SESSION_1' ? '1' : '2';
const getSessionTiming = (session: string) => session === 'SESSION_1' ? '9:30 AM - 1:30 PM' : '2:30 PM - 5:30 PM';
const getVerificationTiming = (session: string) => session === 'SESSION_1' ? '8:30 AM' : '1:30 PM';

/**
 * Send the attendee their ticket: QR shown inline in the body AND attached as a
 * downloadable PNG, with the ticket id + session. Throws on send failure so the
 * caller can record per-ticket email status (it never throws for "not
 * configured" — callers should check isEmailConfigured() first).
 */
export const sendTicketEmail = async (input: TicketEmailInput): Promise<void> => {
  const { to, name, ticketId, session, qrDataUrl } = input;

  // The data URL is "data:image/png;base64,<payload>" — strip the prefix to get
  // the raw bytes for the attachment / inline CID image.
  const base64 = qrDataUrl.split(',')[1] ?? '';
  const qrBuffer = Buffer.from(base64, 'base64');
  const greeting = name ? `Dear ${name},` : 'Dear Attendee,';

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <style>
      @media screen and (max-width: 600px) {
        .responsive-table {
          width: 100% !important;
          background-image: radial-gradient(circle at top left, #f4f4f4 16px, transparent 17px), radial-gradient(circle at top right, #f4f4f4 16px, transparent 17px), radial-gradient(circle at bottom left, #f4f4f4 16px, transparent 17px), radial-gradient(circle at bottom right, #f4f4f4 16px, transparent 17px), linear-gradient(135deg, #000000 0%, #1a0000 60%, #4a0000 100%) !important;
        }
        .responsive-col {
          display: block !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .qr-section {
          border-left: none !important;
          border-top: 2px dashed #444444 !important;
          padding: 30px 20px !important;
        }
        .info-section {
          padding: 30px 20px !important;
        }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #f4f4f4; padding: 30px 15px;">
    
    <p style="color: #111; font-size: 16px; margin-bottom: 25px; text-align: center;">${greeting} Here is your official entry ticket.</p>
    
    <!-- Ticket Container -->
    <table class="responsive-table" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #111111; background-image: radial-gradient(circle at top left, #f4f4f4 16px, transparent 17px), radial-gradient(circle at top right, #f4f4f4 16px, transparent 17px), radial-gradient(circle at bottom left, #f4f4f4 16px, transparent 17px), radial-gradient(circle at bottom right, #f4f4f4 16px, transparent 17px), radial-gradient(circle at 65% 0, #f4f4f4 14px, transparent 15px), radial-gradient(circle at 65% 100%, #f4f4f4 14px, transparent 15px), linear-gradient(135deg, #000000 0%, #1a0000 60%, #4a0000 100%); color: #ffffff; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.3);">
      <tr>
        
        <!-- Left Side: Ticket Details -->
        <td class="responsive-col info-section" width="65%" valign="top" style="padding: 30px;">
          <h1 style="margin: 0; font-size: 28px; color: #e62b1e; font-weight: 800; letter-spacing: 1.5px;">TEDx<span style="color: #ffffff; font-weight: 300;">IITPatna</span></h1>
          <p style="margin: 5px 0 30px 0; font-size: 11px; color: #aaaaaa; text-transform: uppercase; letter-spacing: 3px;">Official Entry Ticket</p>
          
          <p style="margin: 0; font-size: 10px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">Ticket Holder</p>
          <p style="margin: 4px 0 25px 0; font-size: 20px; font-weight: bold; color: #ffffff;">${name || 'Attendee'}</p>
          
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="50%" valign="top">
                <p style="margin: 0; font-size: 10px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">Session</p>
                <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #e62b1e;">${prettySession(session)}</p>
              </td>
              <td width="50%" valign="top">
                <p style="margin: 0; font-size: 10px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">Ticket ID</p>
                <p style="margin: 4px 0 0 0; font-size: 14px; font-family: monospace; color: #cccccc;">${ticketId}</p>
              </td>
            </tr>
          </table>
        </td>
        
        <!-- Right Side: QR Code Stub -->
        <td class="responsive-col qr-section" width="35%" align="center" valign="middle" style="padding: 30px 20px; background-color: rgba(0, 0, 0, 0.4); border-left: 2px dashed #444444;">
          <div style="background-color: #ffffff; padding: 10px; border-radius: 8px; display: inline-block;">
            <img src="cid:ticket-qr" alt="QR Code" width="140" height="140" style="display: block; border: 0;" />
          </div>
          <p style="margin: 15px 0 0 0; font-size: 11px; color: #aaaaaa; text-transform: uppercase; letter-spacing: 2px; text-align: center;">Scan at Gate</p>
        </td>
        
      </tr>
    </table>
    
    <div style="max-width: 600px; margin: 30px auto 0; font-size: 14px; color: #333; line-height: 1.6; background: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
      <p style="margin-top: 0;">We are thrilled to welcome you to TEDxIIT Patna, a day of inspiring ideas, meaningful conversations, and stories that have the power to spark change.</p>
      
      <p>Please find the schedule below:</p>

      <h3 style="color: #e62b1e; margin-top: 20px; margin-bottom: 10px; font-size: 18px;">Event Schedule</h3>
      <p style="margin: 0;"><strong>Date:</strong> 13 September 2026</p>
      <p style="margin: 0;"><strong>Session ${getSessionNumber(session)}:</strong> ${getSessionTiming(session)}</p>
      
      <h3 style="color: #e62b1e; margin-top: 20px; margin-bottom: 10px; font-size: 18px;">Venue</h3>
      <p style="margin: 0;">Auditorium<br/>IIT Patna</p>

      <h3 style="color: #e62b1e; margin-top: 20px; margin-bottom: 10px; font-size: 18px;">Important Guidelines for Attendees</h3>
      <p>To ensure a smooth and hassle-free experience, please keep the following guidelines in mind:</p>
      <ul style="padding-left: 20px; margin-top: 0;">
        <li style="margin-bottom: 8px;">All attendees must report to the venue for verification before the session begins.</li>
        <li style="margin-bottom: 8px;">Verification for Session ${getSessionNumber(session)} will begin from <strong>${getVerificationTiming(session)}</strong>. Please use the QR code sent to your registered email for verification.</li>
        <li style="margin-bottom: 8px;">On-spot registration will be available <b>"only for campus students."</b></li>
        <li style="margin-bottom: 8px;">No entries will be permitted once the session has started. We strongly recommend arriving well in advance.</li>
        <li style="margin-bottom: 8px;">At the time of registration/check-in, attendees are required to carry:
          <ul style="padding-left: 20px; margin-top: 5px;">
            <li style="margin-bottom: 4px;">College ID card or any valid Government ID proof</li>
            <li style="margin-bottom: 4px;">A screenshot of your payment details</li>
            <li style="margin-bottom: 4px;">QR code sent to the registered email.</li>
          </ul>
        </li>
      </ul>
      <p>Keeping these documents readily available will help ensure a quick and hassle-free check-in process.</p>

      <h3 style="color: #e62b1e; margin-top: 20px; margin-bottom: 10px; font-size: 18px;">Please Arrive on Time</h3>
      <p>We encourage everyone to plan their arrival accordingly and complete the verification process before the session begins. Late entry may not be permitted once the session is underway.</p>
      
      <p style="margin-top: 20px;">We look forward to welcoming you to TEDxIIT Patna and taking you on a journey into <strong>Terra Incognita</strong>, a space for unexplored ideas, new perspectives, and meaningful conversations.</p>
      
      <p style="margin-top: 20px; font-weight: bold; font-size: 16px;">See you at TEDxIIT Patna!</p>
    </div>

    <p style="color: #888888; font-size: 12px; margin-top: 25px; text-align: center; line-height: 1.5;">This ticket is unique to you. Do not share it.<br>It can only be checked in once.</p>
  </div>
  </body>
  </html>`;

  const tx = await getTransporter();
  await tx.sendMail({
    from: getConfig().from,
    to,
    subject: `Your TEDxIIT Patna Ticket — ${prettySession(session)}`,
    html,
    attachments: [
      // 1. Inline QR code for the HTML template
      {
        filename: `qr-inline-${ticketId}.png`,
        content: qrBuffer,
        contentType: 'image/png',
        cid: 'ticket-qr', 
      },
      // 2. Downloadable attachment at the bottom of the email
      {
        filename: `TEDx_Ticket_QR_${ticketId}.png`,
        content: qrBuffer,
        contentType: 'image/png',
      },
    ],
  });
};
