import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import type { Types } from 'mongoose';
import { Ticket } from '../model/ticket.model.js';
import type { ITicket } from '../model/ticket.model.js';
import { nextTicketId } from './ticket-id.service.js';
import { sendTicketEmail, isEmailConfigured } from './email.service.js';
import { env } from '../../../config/env.js';
import type { Session } from '../../../shared/domain.js';

export interface IssuanceInput {
  registrationId: Types.ObjectId;
  email: string;
  name: string | null;
  transactionId: string;
  session: Session;
}

export type IssuanceOutcome =
  | { kind: 'ISSUED'; ticket: ITicket }
  | { kind: 'ALREADY_ISSUED'; ticket: ITicket }
  | { kind: 'FAILED'; reason: string };

const DUPLICATE_KEY_ERROR = 11000;

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: number }).code === DUPLICATE_KEY_ERROR;

export const buildQrDataUrl = async (qrToken: string): Promise<string> =>
  QRCode.toDataURL(qrToken, { errorCorrectionLevel: 'H', margin: 4, width: 400 });

export const issueTicket = async (input: IssuanceInput): Promise<IssuanceOutcome> => {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    return { kind: 'FAILED', reason: 'Registration has no email address' };
  }

  const existing = await Ticket.findOne({
    registrationId: input.registrationId,
    session: input.session,
  });
  if (existing) {
    return { kind: 'ALREADY_ISSUED', ticket: existing };
  }

  const ticketId = await nextTicketId(input.session);
  const qrToken = jwt.sign(
    { ticketId, email, userId: email, session: input.session },
    env.JWT_SECRET
  );

  try {
    const ticket = await Ticket.create({
      ticketId,
      registrationId: input.registrationId,
      email,
      name: input.name,
      userId: email,
      session: input.session,
      transactionId: input.transactionId,
      qrToken,
      status: 'ACTIVE',
      isCheckedIn: false,
    });
    return { kind: 'ISSUED', ticket };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const raced = await Ticket.findOne({
        registrationId: input.registrationId,
        session: input.session,
      });
      if (raced) {
        return { kind: 'ALREADY_ISSUED', ticket: raced };
      }
    }
    const reason = error instanceof Error ? error.message : 'Ticket creation failed';
    return { kind: 'FAILED', reason };
  }
};

export type DeliveryOutcome =
  | { kind: 'SENT' }
  | { kind: 'SKIPPED'; reason: string }
  | { kind: 'FAILED'; reason: string };

export const deliverTicket = async (ticket: ITicket): Promise<DeliveryOutcome> => {
  if (!isEmailConfigured()) {
    return { kind: 'SKIPPED', reason: 'Email is not configured' };
  }
  if (!ticket.email) {
    return { kind: 'SKIPPED', reason: 'Ticket has no email address' };
  }

  try {
    const qrDataUrl = await buildQrDataUrl(ticket.qrToken);
    await sendTicketEmail({
      to: ticket.email,
      name: ticket.name ?? undefined,
      ticketId: ticket.ticketId,
      session: ticket.session,
      qrDataUrl,
    });
    await Ticket.updateOne(
      { _id: ticket._id },
      { $set: { emailedAt: new Date(), lastEmailError: null }, $inc: { emailAttempts: 1 } }
    );
    return { kind: 'SENT' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Email delivery failed';
    await Ticket.updateOne(
      { _id: ticket._id },
      { $set: { lastEmailError: reason }, $inc: { emailAttempts: 1 } }
    );
    return { kind: 'FAILED', reason };
  }
};
