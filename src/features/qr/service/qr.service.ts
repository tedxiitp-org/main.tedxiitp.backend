import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { allocateTicket } from './ticket-id.service.js';
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

  const existing = await Ticket.findOne({
    email: normalizedEmail,
    session,
    status: { $ne: 'REVOKED' },
  })
    .select('ticketId')
    .lean();

  if (existing) {
    const label = session === 'SESSION_1' ? 'Session 1' : 'Session 2';
    throw new DuplicateTicketError(
      `${normalizedEmail} already has a ${label} ticket (${existing.ticketId}). Revoke it before issuing a new one.`
    );
  }

  const newTicket = await allocateTicket(session, (ticketId) => ({
    ticketId,
    registrationId: null,
    email: normalizedEmail,
    name: cleanName ?? null,
    userId: normalizedEmail,
    session,
    transactionId,
    qrToken: jwt.sign(
      { ticketId, email: normalizedEmail, userId: normalizedEmail, session },
      secret
    ),
    status: "ACTIVE",
    isCheckedIn: false
  }));

  const qrImageURL = await QRCode.toDataURL(newTicket.qrToken, {
    errorCorrectionLevel: 'H', // high for better scanning
    margin: 4,                 // larger quiet zone for reliable scanning
    width: 400                 // higher resolution base image
  });

  return {
    ticketId: newTicket.ticketId,
    qrCode: qrImageURL,
    qrToken: newTicket.qrToken
  };
};