import jwt from 'jsonwebtoken';
import { Ticket } from '../model/ticket.model.js';
import { Attendance } from '../model/attendance.model.js';

export const validateTicketScan = async (qrToken: string, scannedBy: string, currentScanningSession: string) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is missing");

  let payload: Record<string, unknown>;

  // verify using JWT 
  try {
    const verified = jwt.verify(qrToken, secret);
    if (typeof verified !== 'object' || verified === null) {
      throw new Error('Malformed token payload');
    }
    payload = verified as Record<string, unknown>;
  } catch (error) {
    await logAttendance("UNKNOWN", "UNKNOWN", scannedBy, "FAILED_INVALID");
    return { success: false, status: "FAILED_INVALID", message: "Invalid or forged QR code." };
  }

  const ticketId = typeof payload.ticketId === 'string' ? payload.ticketId : '';
  const session = typeof payload.session === 'string' ? payload.session : '';

  // find the exact ticket in the db
  const ticket = await Ticket.findOne({ ticketId });

  if (!ticket) {
    await logAttendance(ticketId, session, scannedBy, "FAILED_INVALID");
    return { success: false, status: "FAILED_INVALID", message: "Ticket not found in system." };
  }

  if (ticket.status === "REVOKED") {
    await logAttendance(ticketId, session, scannedBy, "FAILED_REVOKED");
    return { success: false, status: "FAILED_REVOKED", message: "This ticket has been revoked." };
  }

  
  if (ticket.session !== currentScanningSession) {
    await logAttendance(ticketId, ticket.session, scannedBy, "FAILED_WRONG_SESSION");
    return { 
      success: false, 
      status: "FAILED_WRONG_SESSION", 
      message: `Access Denied: This ticket is for ${ticket.session}, not ${currentScanningSession}.` 
    };
  }


  const updatedTicket = await Ticket.findOneAndUpdate(
    { ticketId: ticketId, isCheckedIn: false },
    { 
      $set: { 
        isCheckedIn: true, 
        checkedInAt: new Date(), 
        status: "USED" 
      } 
    },
    { returnDocument: 'after' }
  );

  if (!updatedTicket) {

    await logAttendance(ticketId, session, scannedBy, "FAILED_DUPLICATE");
    return { success: false, status: "FAILED_DUPLICATE", message: "Ticket already used!" };
  }

  const siblingAlreadyIn = await Ticket.findOne({
    _id: { $ne: updatedTicket._id },
    email: updatedTicket.email,
    session: updatedTicket.session,
    isCheckedIn: true,
  })
    .select('ticketId checkedInAt')
    .lean();

  if (
    siblingAlreadyIn &&
    siblingAlreadyIn.checkedInAt &&
    updatedTicket.checkedInAt &&
    siblingAlreadyIn.checkedInAt <= updatedTicket.checkedInAt
  ) {
    await Ticket.updateOne(
      { _id: updatedTicket._id },
      { $set: { isCheckedIn: false, checkedInAt: null, status: 'ACTIVE' } }
    );
    await logAttendance(ticketId, session, scannedBy, "FAILED_DUPLICATE");
    return {
      success: false,
      status: "FAILED_DUPLICATE",
      message: `${updatedTicket.email} already entered ${updatedTicket.session} on ticket ${siblingAlreadyIn.ticketId}.`,
    };
  }

  // valid entry
  await logAttendance(ticketId, session, scannedBy, "SUCCESS");
  return { success: true, status: "SUCCESS", message: "Access Granted!", ticket: updatedTicket };
};


const logAttendance = async (
  ticketId: string, 
  session: string, 
  scannedBy: string, 
  status: "SUCCESS" | "FAILED_DUPLICATE" | "FAILED_REVOKED" | "FAILED_INVALID" | "FAILED_WRONG_SESSION"
) => {
  await Attendance.create({
    ticketId,
    session,
    scannedBy,
    validationStatus: status
  });
};

// Revoke by ticketId (single ticket) or by email (all of that attendee's
// tickets, across sessions). Returns the number of tickets revoked.
export const revokeTicket = async (identifier: { ticketId?: string; email?: string }) => {
  if (identifier.ticketId) {
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId: identifier.ticketId },
      { status: "REVOKED" },
      { returnDocument: 'after' }
    );
    return ticket ? 1 : 0;
  }

  if (identifier.email) {
    const email = identifier.email.trim().toLowerCase();
    const result = await Ticket.updateMany(
      { email },
      { status: "REVOKED" }
    );
    return result.modifiedCount;
  }

  return 0;
};