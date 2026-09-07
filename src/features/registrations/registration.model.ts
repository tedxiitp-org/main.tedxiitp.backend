import mongoose, { Schema } from 'mongoose';
import type { Model, Types } from 'mongoose';
import {
  EMAIL_SOURCES,
  REGISTRATION_STATUSES,
  SESSIONS,
  TICKET_TIERS,
  TSHIRT_SIZES,
} from '../../shared/domain.js';
import type {
  EmailSource,
  RegistrationStatus,
  Session,
  TicketTier,
  TshirtSize,
} from '../../shared/domain.js';

export interface IRegistration {
  _id: Types.ObjectId;
  sourceHash: string;
  sourceRow: number;
  submittedAt: Date | null;
  name: string;
  email: string | null;
  emailSource: EmailSource;
  rollNo: string | null;
  instituteId: string | null;
  ticketTypeRaw: string;
  tier: TicketTier;
  sessions: Session[];
  tshirtSize: TshirtSize | null;
  transactionId: string;
  paymentProofUrl: string | null;
  residesAtIITP: boolean | null;
  aadhaarNumber: string | null;
  aadhaarUrl: string | null;
  address: string | null;
  comments: string | null;
  status: RegistrationStatus;
  duplicateOf: Types.ObjectId | null;
  flags: string[];
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  ticketsIssued: number;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const registrationSchema = new Schema<IRegistration>(
  {
    sourceHash: { type: String, required: true, unique: true },
    sourceRow: { type: Number, required: true },
    submittedAt: { type: Date, default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    emailSource: { type: String, enum: EMAIL_SOURCES, default: 'UNRESOLVED' },
    rollNo: { type: String, default: null, trim: true },
    instituteId: { type: String, default: null, trim: true },
    ticketTypeRaw: { type: String, default: '', trim: true },
    tier: { type: String, enum: TICKET_TIERS, default: 'UNRECOGNIZED' },
    sessions: [{ type: String, enum: SESSIONS }],
    tshirtSize: { type: String, enum: TSHIRT_SIZES, default: null },
    transactionId: { type: String, default: '', trim: true },
    paymentProofUrl: { type: String, default: null, trim: true },
    residesAtIITP: { type: Boolean, default: null },
    aadhaarNumber: { type: String, default: null, trim: true },
    aadhaarUrl: { type: String, default: null, trim: true },
    address: { type: String, default: null, trim: true },
    comments: { type: String, default: null, trim: true },
    status: { type: String, enum: REGISTRATION_STATUSES, default: 'PENDING', index: true },
    duplicateOf: { type: Schema.Types.ObjectId, ref: 'Registration', default: null },
    flags: [{ type: String }],
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'QRAdmin', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: null },
    ticketsIssued: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

registrationSchema.index({ transactionId: 1 });
registrationSchema.index({ email: 1 });
registrationSchema.index({ status: 1, tier: 1 });
registrationSchema.index({ submittedAt: -1 });
registrationSchema.index({ name: 'text', email: 'text', transactionId: 'text' });

export const Registration: Model<IRegistration> =
  (mongoose.models.Registration as Model<IRegistration> | undefined) ??
  mongoose.model<IRegistration>('Registration', registrationSchema);
