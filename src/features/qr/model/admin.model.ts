import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
  email: string;
  password: string;
  role: "ADMIN" | "VOLUNTEER";
}

const adminSchema = new Schema<IAdmin>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["ADMIN", "VOLUNTEER"], default: "VOLUNTEER" }
}, { timestamps: true });

export const Admin = mongoose.model<IAdmin>('Admin', adminSchema);