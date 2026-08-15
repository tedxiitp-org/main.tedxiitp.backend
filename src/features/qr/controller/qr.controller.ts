import type { Request, Response } from 'express';
import { Ticket } from '../model/ticket.model.js';
import { generateTicketAndQR, DuplicateTicketError } from '../service/qr.service.js';
import { validateTicketScan, revokeTicket } from '../service/validation.service.js';
import { getAttendanceStats, getVolunteerScanStats } from '../service/attendance.service.js';
import { sendTicketEmail, isEmailConfigured } from '../service/email.service.js';

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
  } catch (err: any) {
    console.error(`Failed to email ticket to ${to}:`, err?.message || err);
    return { emailSent: false, emailError: err?.message || "Send failed" };
  }
};

export const generateTicket = async (req: Request, res: Response): Promise<any> => {
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

    const emailResult = await tryEmailTicket(email, name, ticketData, validSession);

    return res.status(201).json({
      success: true,
      message: "Secure ticket generated successfully",
      data: { ...ticketData, ...emailResult }
    });

  } catch (error: any) {
    if (error instanceof DuplicateTicketError) {
      return res.status(409).json({ success: false, error: error.message });
    }
    console.error("QR Generation Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// Bulk generation from a CSV upload (parsed client-side into rows). One HTTP
// request produces many tickets + emails so the API rate limiter isn't tripped.
// Each row is independent: a duplicate/error on one does not abort the rest.
export const generateTicketsBulk = async (req: Request, res: Response): Promise<any> => {
  try {
    const { attendees, session } = req.body as {
      attendees: { email: string; transactionId: string; name?: string }[];
      session: string;
    };

    if (!Array.isArray(attendees) || attendees.length === 0) {
      return res.status(400).json({ error: "attendees array is required" });
    }
    if (session !== "SESSION_1" && session !== "SESSION_2") {
      return res.status(400).json({ error: "Invalid session type. Must be SESSION_1 or SESSION_2" });
    }
    const validSession = session as ValidSession;

    const results = [];
    // Sequential: keeps memory/SMTP load predictable and preserves row order.
    for (const attendee of attendees) {
      const email = (attendee?.email || "").trim();
      if (!email) {
        results.push({ email: attendee?.email || "", status: "error", message: "Missing email" });
        continue;
      }
      if (!attendee?.transactionId) {
        results.push({ email: attendee?.email || "", status: "error", message: "Missing transaction ID" });
        continue;
      }
      try {
        const ticketData = await generateTicketAndQR(email, validSession, attendee.transactionId, attendee.name);
        const emailResult = await tryEmailTicket(email, attendee.name, ticketData, validSession);
        results.push({
          email,
          status: "generated",
          ticketId: ticketData.ticketId,
          emailSent: emailResult.emailSent,
          message: emailResult.emailError,
        });
      } catch (error: any) {
        if (error instanceof DuplicateTicketError) {
          results.push({ email, status: "duplicate", message: error.message });
        } else {
          console.error(`Bulk generate failed for ${email}:`, error?.message || error);
          results.push({ email, status: "error", message: "Generation failed" });
        }
      }
    }

    const generated = results.filter((r) => r.status === "generated").length;
    return res.status(200).json({
      success: true,
      message: `Generated ${generated} of ${attendees.length} ticket(s).`,
      data: results,
    });
  } catch (error) {
    console.error("Bulk Generation Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const validateScan = async (req: Request, res: Response): Promise<any> => {
  try {
    // 1. Frontend only sends the token and what gate they are at
    const { qrToken, currentScanningSession } = req.body;

    // 2. Security Fix: Extract volunteer/admin ID securely from Passport session
    const scannedBy = (req as any).user?._id || (req as any).user?.id;

    if (!scannedBy) {
       return res.status(401).json({ error: "Unauthorized: No volunteer session found" });
    }

    if (!qrToken || !currentScanningSession) {
      return res.status(400).json({ error: "qrToken and currentScanningSession are required" });
    }

    // 3. Pass the current gate session to the service
    const result = await validateTicketScan(qrToken, scannedBy, currentScanningSession);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(403).json(result);
    }

  } catch (error: any) {
    console.error("QR Validation Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// Full attendee roster for one session: every generated ticket plus whether the
// holder has been scanned in (Attending) or not yet (Absent). Drives the admin
// attendee-list panel, which switches between sessions client-side.
export const getAttendees = async (req: Request, res: Response): Promise<any> => {
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

export const getStats = async (req: Request, res: Response): Promise<any> => {
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

export const getVolunteerStats = async (req: Request, res: Response): Promise<any> => {
  try {
    const stats = await getVolunteerScanStats();
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error("Volunteer Stats Error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch volunteer stats" });
  }
};

export const handleRevoke = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ticketId, email } = req.body;

    // Security check for revoking
    const adminId = (req as any).user?._id || (req as any).user?.id;
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
export const handleRevokeBulk = async (req: Request, res: Response): Promise<any> => {
  try {
    const { emails } = req.body as { emails: string[] };

    const adminId = (req as any).user?._id || (req as any).user?.id;
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
      } catch (error: any) {
        console.error(`Bulk revoke failed for ${email}:`, error?.message || error);
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

export const exportAttendees = async (req: Request, res: Response): Promise<any> => {
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