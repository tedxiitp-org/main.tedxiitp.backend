import { Schema, model, Types } from "mongoose";

export interface AttachmentPayload {
  filename: string;
  url: string;
  mimeType: string;
}

export interface MailLog {
  _id: Types.ObjectId;
  recipientEmail: string;
  subject: string;
  templateName: string;
  status: "queued" | "processing" | "sent" | "failed";
  retryCount: number;
  providerMessageId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendEmailJob {
  recipientEmail: string;
  recipientName?: string;
  templateName: string;
  subject: string;
  variables: Record<string, any>;
  attachments?: AttachmentPayload[];
  metadata?: Record<string, any>;
}

const MailLogSchema = new Schema<MailLog>(
  {
    recipientEmail: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    templateName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "sent", "failed"],
      default: "queued",
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    providerMessageId: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
    },
    sentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const MailLogModel = model<MailLog>("MailLog", MailLogSchema);
