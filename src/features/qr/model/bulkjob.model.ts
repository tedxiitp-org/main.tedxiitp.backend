import mongoose, { Document, Schema } from 'mongoose';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface IBulkJob extends Document {
  adminId: mongoose.Types.ObjectId | string;
  status: JobStatus;
  totalRecords: number;
  processedRecords: number;
  createdAt: Date;
  updatedAt: Date;
}

const BulkJobSchema: Schema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    status: { 
      type: String, 
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], 
      default: 'PENDING' 
    },
    totalRecords: { type: Number, required: true },
    processedRecords: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const BulkJob = mongoose.model<IBulkJob>('BulkJob', BulkJobSchema);


export type BulkItemStatus = 'pending' | 'working' | 'generated' | 'duplicate' | 'error';

export interface IBulkJobItem extends Document {
  jobId: mongoose.Types.ObjectId | string;
  email: string;
  name?: string;
  transactionId: string;
  session: string;
  status: BulkItemStatus;
  ticketId?: string;
  emailSent?: boolean;
  message?: string;
}

const BulkJobItemSchema: Schema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'BulkJob', required: true, index: true },
    email: { type: String, required: true },
    name: { type: String },
    transactionId: { type: String, required: true },
    session: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'working', 'generated', 'duplicate', 'error'], 
      default: 'pending' 
    },
    ticketId: { type: String },
    emailSent: { type: Boolean },
    message: { type: String },
  }
);

export const BulkJobItem = mongoose.model<IBulkJobItem>('BulkJobItem', BulkJobItemSchema);
