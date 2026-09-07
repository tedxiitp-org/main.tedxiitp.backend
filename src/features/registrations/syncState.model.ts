import mongoose, { Schema } from 'mongoose';
import type { Model, Types } from 'mongoose';

export interface ISyncState {
  _id: Types.ObjectId;
  key: string;
  lastSyncedAt: Date;
  lastRowsRead: number;
  lastCreated: number;
  lastUpdated: number;
  lastError: string | null;
  triggeredBy: string;
}

const syncStateSchema = new Schema<ISyncState>({
  key: { type: String, required: true, unique: true },
  lastSyncedAt: { type: Date, default: () => new Date(0) },
  lastRowsRead: { type: Number, default: 0 },
  lastCreated: { type: Number, default: 0 },
  lastUpdated: { type: Number, default: 0 },
  lastError: { type: String, default: null },
  triggeredBy: { type: String, default: 'none' },
});

export const SyncState: Model<ISyncState> =
  (mongoose.models.SyncState as Model<ISyncState> | undefined) ??
  mongoose.model<ISyncState>('SyncState', syncStateSchema);

export const SHEET_SYNC_KEY = 'google_sheet';
