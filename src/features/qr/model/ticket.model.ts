import mongoose, { Document, Schema } from 'mongoose';

export interface ITicket extends Document {
  ticketId: string;
  email: string;
  name?: string;
  userId: string;
  session: "SESSION_1" | "SESSION_2";
  transactionId: string;
  qrToken: string;

  status: "ACTIVE" | "REVOKED" | "USED";
  isCheckedIn: boolean;
  checkedInAt?: Date;
}

const ticketSchema = new Schema<ITicket>({
  ticketId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  // Optional attendee name, captured at generation so the admin attendee list
  // can show a human-readable name alongside the email. Tickets created before
  // this field existed simply won't have one.
  name: { type: String },
  userId: { type: String, required: true },
  session: { type: String, enum: ["SESSION_1", "SESSION_2"], required: true },
  transactionId: { type: String, required: true },
  qrToken: { type: String, required: true },
  status: { type: String, enum: ["ACTIVE", "REVOKED", "USED"], default: "ACTIVE" },
  isCheckedIn: { type: Boolean, default: false },
  checkedInAt: { type: Date }
}, { timestamps: true });

// An attendee (identified by email) may hold at most one ticket per session.
ticketSchema.index({ email: 1, session: 1 }, { unique: true });

export const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);