import mongoose, { Document, Schema } from 'mongoose';

export interface ICounter extends Document {
  key: string;
  sequence: number;
}

const counterSchema = new Schema<ICounter>({
  key: { type: String, required: true, unique: true },
  sequence: { type: Number, default: 0 }
});

export const Counter = mongoose.model<ICounter>('Counter', counterSchema);