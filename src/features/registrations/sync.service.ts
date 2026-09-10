import type { AnyBulkWriteOperation } from 'mongoose';
import { Types } from 'mongoose';
import { Ticket } from '../qr/model/ticket.model.js';
import { Registration } from './registration.model.js';
import type { IRegistration } from './registration.model.js';
import { normalizeSheet } from './normalize.js';
import type { NormalizedRegistration } from './normalize.js';
import { fetchSheetRows } from './sheets.service.js';
import { SHEET_SYNC_KEY, SyncState } from './syncState.model.js';

type RegistrationUpdate = Partial<Omit<IRegistration, '_id' | 'createdAt' | 'updatedAt'>>;

export interface SyncResult {
  rowsRead: number;
  registrations: number;
  collapsedRows: number;
  created: number;
  updated: number;
  unchanged: number;
  duplicatesMarked: number;
  removedFromSheet: number;
  restored: number;
  keptDespiteRemoval: number;
  syncedAt: Date;
}

const sheetFields = (row: NormalizedRegistration, syncedAt: Date) => ({
  sourceRow: row.sourceRow,
  submittedAt: row.submittedAt,
  name: row.name,
  rollNo: row.rollNo,
  instituteId: row.instituteId,
  ticketTypeRaw: row.ticketTypeRaw,
  tier: row.tier,
  sessions: row.sessions,
  tshirtSize: row.tshirtSize,
  transactionId: row.transactionId,
  paymentProofUrl: row.paymentProofUrl,
  residesAtIITP: row.residesAtIITP,
  aadhaarNumber: row.aadhaarNumber,
  aadhaarUrl: row.aadhaarUrl,
  address: row.address,
  comments: row.comments,
  flags: row.flags,
  lastSyncedAt: syncedAt,
});

export const syncRegistrations = async (rows: string[][]): Promise<SyncResult> => {
  const normalized = normalizeSheet(rows);
  const syncedAt = new Date();

  if (normalized.length === 0) {
    return {
      rowsRead: 0,
      registrations: 0,
      collapsedRows: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      duplicatesMarked: 0,
      removedFromSheet: 0,
      restored: 0,
      keptDespiteRemoval: 0,
      syncedAt,
    };
  }

  const hashes = normalized.map((row) => row.sourceHash);
  const distinctHashes = new Set(hashes).size;
  const existing = await Registration.find({ sourceHash: { $in: hashes } })
    .select('sourceHash emailSource')
    .lean();

  const manualEmailHashes = new Set(
    existing.filter((doc) => doc.emailSource === 'MANUAL').map((doc) => doc.sourceHash)
  );
  const existingHashes = new Set(existing.map((doc) => doc.sourceHash));

  const operations: AnyBulkWriteOperation<IRegistration>[] = normalized.map((row) => {
    const set: RegistrationUpdate = sheetFields(row, syncedAt);
    if (!manualEmailHashes.has(row.sourceHash)) {
      set.email = row.email;
      set.emailSource = row.emailSource;
    }
    return {
      updateOne: {
        filter: { sourceHash: row.sourceHash },
        update: {
          $set: set,
          $setOnInsert: {
            sourceHash: row.sourceHash,
            status: 'PENDING' as const,
            ticketsIssued: 0,
          },
        },
        upsert: true,
      },
    };
  });

  const result = await Registration.bulkWrite(operations, { ordered: false });
  const created = result.upsertedCount ?? 0;
  const updated = result.modifiedCount ?? 0;

  const restored = await Registration.updateMany(
    { lastSyncedAt: syncedAt, status: 'REMOVED' },
    { $set: { status: 'PENDING' } }
  );

  const duplicatesMarked = await markDuplicates();
  const reconciliation = await reconcileRemovals(syncedAt);

  return {
    rowsRead: normalized.length,
    registrations: distinctHashes,
    collapsedRows: normalized.length - distinctHashes,
    created,
    updated: Math.min(updated, distinctHashes - created),
    unchanged: Math.max(distinctHashes - created - updated, 0),
    duplicatesMarked,
    removedFromSheet: reconciliation.removed,
    restored: restored.modifiedCount,
    keptDespiteRemoval: reconciliation.kept,
    syncedAt,
  };
};

const registrationIdsWithTickets = async (): Promise<Types.ObjectId[]> => {
  const ids = await Ticket.distinct('registrationId', { registrationId: { $ne: null } });
  return ids.filter((id): id is Types.ObjectId => id instanceof Types.ObjectId);
};

export const reconcileRemovals = async (
  syncedAt: Date
): Promise<{ removed: number; kept: number }> => {
  const ticketed = await registrationIdsWithTickets();
  const missing = { lastSyncedAt: { $lt: syncedAt }, status: { $ne: 'REMOVED' as const } };

  const kept = await Registration.countDocuments({ ...missing, _id: { $in: ticketed } });

  const outcome = await Registration.updateMany(
    { ...missing, _id: { $nin: ticketed } },
    { $set: { status: 'REMOVED' } }
  );

  return { removed: outcome.modifiedCount, kept };
};

export const restoreTicketedRegistrations = async (): Promise<number> => {
  const ticketed = await registrationIdsWithTickets();
  const outcome = await Registration.updateMany(
    { _id: { $in: ticketed }, status: 'REMOVED' },
    { $set: { status: 'APPROVED' } }
  );
  return outcome.modifiedCount;
};

export const purgeRemoved = async (): Promise<number> => {
  const ticketed = await registrationIdsWithTickets();
  const outcome = await Registration.deleteMany({
    status: 'REMOVED',
    _id: { $nin: ticketed },
  });
  return outcome.deletedCount;
};

export const markDuplicates = async (): Promise<number> => {
  const groups = await Registration.aggregate<{ _id: string; ids: IRegistration['_id'][] }>([
    { $match: { transactionId: { $nin: ['', null] } } },
    { $sort: { submittedAt: 1, _id: 1 } },
    { $group: { _id: '$transactionId', ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  let marked = 0;
  for (const group of groups) {
    const [primary, ...rest] = group.ids;
    if (!primary || rest.length === 0) continue;
    const outcome = await Registration.updateMany(
      { _id: { $in: rest }, status: 'PENDING' },
      { $set: { status: 'DUPLICATE', duplicateOf: primary } }
    );
    marked += outcome.modifiedCount;
  }
  return marked;
};

export const syncFromGoogleSheet = async (triggeredBy = 'manual'): Promise<SyncResult> => {
  try {
    const rows = await fetchSheetRows();
    const result = await syncRegistrations(rows);
    await SyncState.findOneAndUpdate(
      { key: SHEET_SYNC_KEY },
      {
        $set: {
          lastSyncedAt: result.syncedAt,
          lastRowsRead: result.rowsRead,
          lastCreated: result.created,
          lastUpdated: result.updated,
          lastError: null,
          triggeredBy,
        },
      },
      { upsert: true }
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sheet sync failed';
    await SyncState.findOneAndUpdate(
      { key: SHEET_SYNC_KEY },
      { $set: { lastError: message, triggeredBy } },
      { upsert: true }
    );
    throw error;
  }
};

export interface SyncStatus {
  lastSyncedAt: Date | null;
  lastRowsRead: number;
  lastError: string | null;
  triggeredBy: string;
}

export const getSyncStatus = async (): Promise<SyncStatus> => {
  const state = await SyncState.findOne({ key: SHEET_SYNC_KEY }).lean();
  if (!state) {
    return { lastSyncedAt: null, lastRowsRead: 0, lastError: null, triggeredBy: 'none' };
  }
  return {
    lastSyncedAt: state.lastSyncedAt.getTime() === 0 ? null : state.lastSyncedAt,
    lastRowsRead: state.lastRowsRead,
    lastError: state.lastError,
    triggeredBy: state.triggeredBy,
  };
};

export const syncIfStale = async (
  minIntervalMs: number,
  triggeredBy: string
): Promise<{ ran: boolean; result: SyncResult | null }> => {
  const claimedAt = new Date();
  const claim = await SyncState.findOneAndUpdate(
    {
      key: SHEET_SYNC_KEY,
      lastSyncedAt: { $lt: new Date(claimedAt.getTime() - minIntervalMs) },
    },
    { $set: { lastSyncedAt: claimedAt } },
    { returnDocument: 'after' }
  );

  if (!claim) {
    const existing = await SyncState.findOne({ key: SHEET_SYNC_KEY }).lean();
    if (existing) {
      return { ran: false, result: null };
    }
    await SyncState.create({ key: SHEET_SYNC_KEY, lastSyncedAt: claimedAt });
  }

  const result = await syncFromGoogleSheet(triggeredBy);
  return { ran: true, result };
};
