import mongoose, { Schema } from 'mongoose';
import type { Model, Types } from 'mongoose';
import { ACCOUNT_ROLES, SESSIONS } from '../../../shared/domain.js';
import type { AccountRole, Session } from '../../../shared/domain.js';

export interface IAccount {
  _id: Types.ObjectId;
  email: string;
  password: string;
  name: string | null;
  role: AccountRole;
  isActive: boolean;
  allowedSessions: Session[];
  createdBy: Types.ObjectId | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<IAccount>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, default: null, trim: true },
    role: { type: String, enum: ACCOUNT_ROLES, default: 'VOLUNTEER' },
    isActive: { type: Boolean, default: true },
    allowedSessions: [{ type: String, enum: SESSIONS }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'QRAdmin', default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

accountSchema.index({ role: 1, isActive: 1 });

export const Admin: Model<IAccount> =
  (mongoose.models.QRAdmin as Model<IAccount> | undefined) ??
  mongoose.model<IAccount>('QRAdmin', accountSchema);

export type IAdmin = IAccount;
