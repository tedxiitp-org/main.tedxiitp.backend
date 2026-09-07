import mongoose, { Schema } from 'mongoose';
import type { Model, Types } from 'mongoose';
import { SESSIONS, TICKET_STATUSES } from '../../../shared/domain.js';
import type { Session, TicketStatus } from '../../../shared/domain.js';

export interface ITicket {
  _id: Types.ObjectId;
  ticketId: string;
  registrationId: Types.ObjectId | null;
  email: string;
  name: string | null;
  userId: string;
  session: Session;
  transactionId: string;
  qrToken: string;
  status: TicketStatus;
  isCheckedIn: boolean;
  checkedInAt: Date | null;
  emailedAt: Date | null;
  emailAttempts: number;
  lastEmailError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    ticketId: { type: String, required: true, unique: true },
    registrationId: { type: Schema.Types.ObjectId, ref: 'Registration', default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, default: null },
    userId: { type: String, required: true },
    session: { type: String, enum: SESSIONS, required: true },
    transactionId: { type: String, required: true },
    qrToken: { type: String, required: true },
    status: { type: String, enum: TICKET_STATUSES, default: 'ACTIVE' },
    isCheckedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
    emailedAt: { type: Date, default: null },
    emailAttempts: { type: Number, default: 0 },
    lastEmailError: { type: String, default: null },
  },
  { timestamps: true }
);

ticketSchema.index(
  { registrationId: 1, session: 1 },
  { unique: true, partialFilterExpression: { registrationId: { $type: 'objectId' } } }
);
ticketSchema.index({ email: 1, session: 1 });
ticketSchema.index({ session: 1, isCheckedIn: 1 });
ticketSchema.index({ createdAt: -1 });

export const Ticket: Model<ITicket> =
  (mongoose.models.Ticket as Model<ITicket> | undefined) ??
  mongoose.model<ITicket>('Ticket', ticketSchema);
