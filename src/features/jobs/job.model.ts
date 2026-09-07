import mongoose, { Schema } from 'mongoose';
import type { Model, Types } from 'mongoose';
import { JOB_ITEM_STATUSES, JOB_STATUSES, SESSIONS } from '../../shared/domain.js';
import type { JobItemStatus, JobStatus, Session } from '../../shared/domain.js';

export interface IJob {
  _id: Types.ObjectId;
  label: string;
  createdBy: Types.ObjectId;
  status: JobStatus;
  totalItems: number;
  processed: number;
  succeeded: number;
  alreadyIssued: number;
  failed: number;
  skipped: number;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  lastPumpAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IJob>(
  {
    label: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'QRAdmin', required: true },
    status: { type: String, enum: JOB_STATUSES, default: 'PENDING', index: true },
    totalItems: { type: Number, required: true },
    processed: { type: Number, default: 0 },
    succeeded: { type: Number, default: 0 },
    alreadyIssued: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    leaseOwner: { type: String, default: null },
    leaseExpiresAt: { type: Date, default: null },
    lastPumpAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

jobSchema.index({ createdAt: -1 });

export const Job: Model<IJob> =
  (mongoose.models.Job as Model<IJob> | undefined) ?? mongoose.model<IJob>('Job', jobSchema);

export interface IJobItem {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  registrationId: Types.ObjectId;
  session: Session;
  email: string | null;
  name: string | null;
  status: JobItemStatus;
  attempts: number;
  nextAttemptAt: Date;
  claimedAt: Date | null;
  ticketId: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const jobItemSchema = new Schema<IJobItem>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    registrationId: { type: Schema.Types.ObjectId, ref: 'Registration', required: true },
    session: { type: String, enum: SESSIONS, required: true },
    email: { type: String, default: null },
    name: { type: String, default: null },
    status: { type: String, enum: JOB_ITEM_STATUSES, default: 'PENDING' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    claimedAt: { type: Date, default: null },
    ticketId: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

jobItemSchema.index({ jobId: 1, registrationId: 1, session: 1 }, { unique: true });
jobItemSchema.index({ jobId: 1, status: 1, nextAttemptAt: 1 });

export const JobItem: Model<IJobItem> =
  (mongoose.models.JobItem as Model<IJobItem> | undefined) ??
  mongoose.model<IJobItem>('JobItem', jobItemSchema);
