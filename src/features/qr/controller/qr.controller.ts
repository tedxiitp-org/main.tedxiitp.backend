import type { Request, Response } from 'express';
import { Ticket } from '../model/ticket.model.js';
import { generateTicketAndQR, DuplicateTicketError, DuplicateTransactionError } from '../service/qr.service.js';
import { validateTicketScan, revokeTicket } from '../service/validation.service.js';
import { getAttendanceStats, getVolunteerScanStats } from '../service/attendance.service.js';
import { sendTicketEmail, isEmailConfigured } from '../service/email.service.js';
import { deliverTicket } from '../service/issuance.service.js';
import { Registration } from '../../registrations/registration.model.js';
import { z } from 'zod';
import { getPrincipal } from '../../../shared/principal.js';
import { canScanSession } from '../../../middleware/auth.middleware.js';
import { sessionSchema } from '../../../shared/domain.js';

const scanSchema = z.object({
  qrToken: z.string().min(1),
  currentScanningSession: sessionSchema,
});

type ValidSession = "SESSION_1" | "SESSION_2";

// Try to email a ticket; never throws — returns the outcome so callers can
// report it without failing ticket generation when SMTP is down/unconfigured.
const tryEmailTicket = async (
  to: string,
  name: string | undefined,
  ticketData: { ticketId: string; qrCode: string },
  session: ValidSession
): Promise<{ emailSent: boolean; emailError?: string }> => {
  if (!isEmailConfigured()) {
    return { emailSent: false, emailError: "Email not configured" };
  }
  try {
    await sendTicketEmail({
      to,
      name,
      ticketId: ticketData.ticketId,
      session,
      qrDataUrl: ticketData.qrCode,
    });
    return { emailSent: true };
  } catch (err: unknown) {
    console.error(`Failed to email ticket to ${to}:`, err instanceof Error ? err.message : err);
    return { emailSent: false, emailError: err instanceof Error ? err.message : 'Send failed' };
  }
};

export const generateTicket = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { email, session, transactionId, name } = req.body;

    // basic Validation
    if (!email || !session || !transactionId) {
      return res.status(400).json({ error: "email, session, and transactionId are required" });
    }

    if (session !== "SESSION_1" && session !== "SESSION_2") {
      return res.status(400).json({ error: "Invalid session type. Must be SESSION_1 or SESSION_2" });
    }
    const validSession = session as ValidSession;

    const ticketData = await generateTicketAndQR(email, validSession, transactionId, name);

    const normalizedEmail = String(email).trim().toLowerCase();
    const registration = await Registration.findOne({
      email: normalizedEmail,
      status: 'APPROVED',
    })
      .select('_id')
      .lean();

    if (registration) {
      await Ticket.updateOne(
        { ticketId: ticketData.ticketId },
        { $set: { registrationId: registration._id } }
      );
    }

    const ticket = await Ticket.findOne({ ticketId: ticketData.ticketId });
    if (!ticket) {
      return res.status(500).json({ success: false, error: "Ticket could not be loaded after creation" });
    }

    const delivery = await deliverTicket(ticket);

    return res.status(201).json({
      success: true,
      message: "Secure ticket generated successfully",
      data: {
        ...ticketData,
        emailSent: delivery.kind === 'SENT',
        emailError: delivery.kind === 'SENT' ? undefined : delivery.reason,
      },
    });

  } catch (error: unknown) {
    if (error instanceof DuplicateTicketError || error instanceof DuplicateTransactionError) {
      return res.status(409).json({ success: false, error: error.message });
    }
    console.error("QR Generation Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// Async worker to process the queue in the background
export const validateScan = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const parsed = scanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "qrToken and a valid currentScanningSession are required" });
    }

    const principal = getPrincipal(req);
    const { qrToken, currentScanningSession } = parsed.data;

    if (!canScanSession(principal, currentScanningSession)) {
      return res.status(403).json({
        success: false,
        status: "FAILED_SESSION_NOT_ALLOWED",
        message: `You are not assigned to ${currentScanningSession}.`,
      });
    }

    const result = await validateTicketScan(qrToken, principal.id, currentScanningSession);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(403).json(result);
    }

  } catch (error: unknown) {
    console.error("QR Validation Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// Full attendee roster for one session: every generated ticket plus whether the
// holder has been scanned in (Attending) or not yet (Absent). Drives the admin
// attendee-list panel, which switches between sessions client-side.
export const getAttendees = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const session = req.query.session;
    if (session !== "SESSION_1" && session !== "SESSION_2") {
      return res
        .status(400)
        .json({ error: "Invalid or missing session. Use SESSION_1 or SESSION_2." });
    }

    // Newest first so freshly generated tickets appear at the top.
    const tickets = await Ticket.find({ session })
      .select("ticketId email name transactionId status isCheckedIn checkedInAt")
      .sort({ createdAt: -1 })
      .lean();

    const data = tickets.map((t) => ({
      ticketId: t.ticketId,
      email: t.email,
      name: t.name || null,
      transactionId: t.transactionId,
      ticketStatus: t.status, // ACTIVE | REVOKED | USED
      isCheckedIn: Boolean(t.isCheckedIn),
      // "ATTENDING" once scanned at the gate, otherwise "ABSENT".
      attendance: t.isCheckedIn ? "ATTENDING" : "ABSENT",
      checkedInAt: t.checkedInAt || null,
    }));

    const attending = data.filter((d) => d.isCheckedIn).length;
    return res.status(200).json({
      success: true,
      data,
      summary: { total: data.length, attending, absent: data.length - attending },
    });
  } catch (error) {
    console.error("Attendees Error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch attendees" });
  }
};

export const getStats = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const stats = await getAttendanceStats();
    
    return res.status(200).json({ 
      success: true, 
      data: stats 
    });
  } catch (error) {
    console.error("Stats Error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
};

export const getVolunteerStats = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const stats = await getVolunteerScanStats();
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error("Volunteer Stats Error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch volunteer stats" });
  }
};

export const handleRevoke = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { ticketId, email } = req.body;

    // Security check for revoking
    const adminId = getPrincipal(req).id;
    if (!adminId) return res.status(401).json({ error: "Unauthorized" });

    if (!ticketId && !email) {
      return res.status(400).json({ error: "Provide a ticketId or an email to revoke" });
    }

    const revokedCount = await revokeTicket({ ticketId, email });
    if (revokedCount === 0) {
      return res.status(404).json({ error: "No matching ticket found" });
    }

    const message =
      revokedCount === 1
        ? "Ticket revoked"
        : `${revokedCount} tickets revoked`;
    res.status(200).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ error: "Revocation failed" });
  }
};

// Bulk revoke by a list of emails (one request, mirrors generate-bulk). Returns
// a per-email result so the UI can show which rows were actually revoked.
export const handleRevokeBulk = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { emails } = req.body as { emails: string[] };

    const adminId = getPrincipal(req).id;
    if (!adminId) return res.status(401).json({ error: "Unauthorized" });

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: "emails array is required" });
    }

    const results = [];
    for (const raw of emails) {
      const email = (raw || "").trim();
      if (!email) {
        results.push({ email: raw || "", status: "error", message: "Missing email" });
        continue;
      }
      try {
        const revokedCount = await revokeTicket({ email });
        results.push({
          email,
          status: revokedCount > 0 ? "revoked" : "not_found",
          revokedCount,
        });
      } catch (error: unknown) {
        console.error(`Bulk revoke failed for ${email}:`, error instanceof Error ? error.message : error);
        results.push({ email, status: "error", message: "Revocation failed" });
      }
    }

    const revoked = results.filter((r) => r.status === "revoked").length;
    return res.status(200).json({
      success: true,
      message: `Revoked tickets for ${revoked} of ${emails.length} email(s).`,
      data: results,
    });
  } catch (error) {
    return res.status(500).json({ error: "Bulk revocation failed" });
  }
};

export const exportAttendees = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const session = req.query.session;
    const filter: any = {};
    if (session) {
      if (session !== "SESSION_1" && session !== "SESSION_2") {
        return res.status(400).json({ error: "Invalid session type." });
      }
      filter.session = session;
    }

    const tickets = await Ticket.find(filter)
      .select("ticketId email name transactionId session status isCheckedIn checkedInAt")
      .sort({ createdAt: -1 })
      .lean();

    const csvHeaders = ["Ticket ID", "Name", "Email", "Transaction ID", "Session", "Status", "Is Checked In", "Checked In At"];
    const csvRows = tickets.map((t: any) => [
      t.ticketId,
      t.name ? `"${t.name.replace(/"/g, '""')}"` : "",
      t.email ? `"${t.email.replace(/"/g, '""')}"` : "",
      t.transactionId ? `"${t.transactionId.replace(/"/g, '""')}"` : "",
      t.session,
      t.status,
      t.isCheckedIn ? "Yes" : "No",
      t.checkedInAt ? t.checkedInAt.toISOString() : ""
    ].join(","));

    const csvContent = [csvHeaders.join(","), ...csvRows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="attendees${session ? '_' + session : ''}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export Attendees Error:", error);
    return res.status(500).json({ success: false, error: "Failed to export attendees" });
  }
};
export const deliverUnsentTickets = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    if (!isEmailConfigured()) {
      return res.status(400).json({ error: "Email is not configured" });
    }

    const limit = Math.min(Math.max(Number(req.body?.limit ?? 25), 1), 100);
    const budgetMs = Math.min(Math.max(Number(req.body?.budgetMs ?? 8000), 1000), 60000);

    const pending = await Ticket.find({ emailedAt: null, status: { $ne: 'REVOKED' } })
      .sort({ createdAt: 1 })
      .limit(limit);

    const startedAt = Date.now();
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const ticket of pending) {
      if (Date.now() - startedAt > budgetMs) break;
      const outcome = await deliverTicket(ticket);
      if (outcome.kind === 'SENT') {
        sent += 1;
      } else {
        failed += 1;
        errors.push(`${ticket.ticketId}: ${outcome.reason}`);
      }
    }

    const remaining = await Ticket.countDocuments({ emailedAt: null, status: { $ne: 'REVOKED' } });

    return res.status(200).json({
      success: true,
      data: { sent, failed, remaining, errors: errors.slice(0, 10) },
    });
  } catch (error) {
    console.error("Deliver unsent tickets error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};
