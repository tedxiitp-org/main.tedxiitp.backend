import { Schema, model, Types } from "mongoose";

export interface EmailTemplate {
  _id: Types.ObjectId;
  name: string;
  subject: string;
  htmlBody: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmailTemplateSchema = new Schema<EmailTemplate>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
    },
    htmlBody: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const EmailTemplateModel = model<EmailTemplate>("EmailTemplate", EmailTemplateSchema);
