import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { Counter } from '../model/counter.model.js';
import { Ticket } from '../model/ticket.model.js';

export class DuplicateTicketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateTicketError';
  }
}

// Thrown when a transaction ID is already used globally.
export class DuplicateTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateTransactionError';
  }
}

// generate Sequential ID based on session
const generateTicketId = async (session: "SESSION_1" | "SESSION_2"): Promise<string> => {
  // 81 for session 1 and 82 for 2nd
  const counterKey = session === "SESSION_1" ? 'ticket_sequence_81' : 'ticket_sequence_82';
  const sessionCode = session === "SESSION_1" ? "81" : "82";
 
  const counter = await Counter.findOneAndUpdate(
    { key: counterKey },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true } 
  );

  // pad the number with zeroes (1 becomes 0001)
  const sequenceStr = counter.sequence.toString().padStart(4, '0');
  return `TEDXIITP-26-${sessionCode}-${sequenceStr}`;
};

// generate and save the QR Code. The attendee is identified by their email,
// which is unique per session — one ticket per email per session.
export const generateTicketAndQR = async (
  email: string,
  session: "SESSION_1" | "SESSION_2",
  transactionId: string,
  name?: string
) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is missing from .env");

  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = name?.trim() || undefined;
  
  if (!transactionId) {
    throw new Error("transactionId is required to generate a ticket");
  }

  // (Transaction IDs can be duplicated if an attendee pays for multiple tickets or both sessions together)



  const ticketId = await generateTicketId(session);

  const payload = {
    ticketId,
    email: normalizedEmail,
    userId: normalizedEmail,
    session
  };

  // sign the token
  const qrToken = jwt.sign(payload, secret);


  const qrImageURL = await QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: 'H', // high for better scanning
    margin: 4,                 // larger quiet zone for reliable scanning
    width: 400                 // higher resolution base image
  });

  // save the ticket to the database
  try {
    const newTicket = await Ticket.create({
      ticketId,
      email: normalizedEmail,
      name: cleanName,
      userId: normalizedEmail,
      session,
      transactionId,
      qrToken,
      status: "ACTIVE",
      isCheckedIn: false
    });

    return {
      ticketId: newTicket.ticketId,
      qrCode: qrImageURL,
      qrToken: qrToken
    };
  } catch (err: any) {
    if (err?.code === 11000) {
      // (Any index violations, though we removed unique transaction IDs)
    }
    throw err;
  }
};