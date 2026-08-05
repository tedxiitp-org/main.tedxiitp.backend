import mongoose, { Schema, Document, Model } from 'mongoose';
import { AdminRole } from '../../types/index.js';

export interface IAdmin extends Document {
  id: string;
  name: string;
  email: string;
  hashedPassword?: string; 
  role: AdminRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  __v?: number;
}

const AdminSchema = new Schema<IAdmin>(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true, 
      trim: true 
    },
    // select: false ensures this is never returned unless explicitly requested
    hashedPassword: { 
      type: String, 
      required: true, 
      select: false 
    },
    role: { 
      type: String, 
      enum: Object.values(AdminRole), 
      default: AdminRole.Admin 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    lastLoginAt: { 
      type: Date 
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        // strip out sensitive fields before sending response
        delete ret.hashedPassword;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Admin: Model<IAdmin> = mongoose.model<IAdmin>('Admin', AdminSchema);

// queries
export const findAdminByEmail = (email: string): ReturnType<typeof Admin.findOne> => {
  return Admin.findOne({ email }).select('+hashedPassword');
};

export const findAdminById = (id: string): ReturnType<typeof Admin.findById> => {
  return Admin.findById(id);
};