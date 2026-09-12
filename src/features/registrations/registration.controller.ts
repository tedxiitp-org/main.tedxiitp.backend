import type { Request, Response } from 'express';
import { z } from 'zod';
import { Registration } from './registration.model.js';
import {
  getSyncStatus,
  purgeRemoved,
  syncFromGoogleSheet,
  syncIfStale,
  syncRegistrations,
} from './sync.service.js';
import { isSheetsConfigured, sheetsMode } from './sheets.service.js';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { Ticket } from '../qr/model/ticket.model.js';
import { registrationStatusSchema, ticketTierSchema } from '../../shared/domain.js';
import { asyncHandler, objectIdParam, parseWith, respondInvalid, toObjectId } from '../../shared/http.js';
import { getPrincipalObjectId } from '../../shared/principal.js';

const listQuerySchema = z.object({
  status: registrationStatusSchema.optional(),
  tier: ticketTierSchema.optional(),
  flagged: z.enum(['true', 'false']).optional(),
  includeMerchOnly: z.enum(['true', 'false']).default('false'),
  search: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const decisionSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

const bulkDecisionSchema = z.object({
  registrationIds: z.array(z.string()).min(1).max(1000),
  notes: z.string().trim().max(500).optional(),
});

const updateSchema = z.object({
  email: z.email().optional(),
  reviewNotes: z.string().trim().max(500).optional(),
});

const importSchema = z.object({
  rows: z.array(z.array(z.string())).min(1),
});

export const listRegistrations = asyncHandler(async (req: Request, res: Response) => {
  const parsed = parseWith(listQuerySchema, req.query);
  if (!parsed.ok) {
    respondInvalid(res, parsed.issues);
    return;
  }
  const { status, tier, flagged, search, page, pageSize, includeMerchOnly } = parsed.data;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  else filter.status = { $ne: 'REMOVED' };
  if (tier) filter.tier = tier;
  else if (includeMerchOnly !== 'true') filter.tier = { $ne: 'MERCH_ONLY' };
  if (flagged === 'true') filter['flags.0'] = { $exists: true };
  if (flagged === 'false') filter.flags = { $size: 0 };
  if (search) {
    const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { transactionId: pattern }];
  }

  const [items, total] = await Promise.all([
    Registration.find(filter)
      .sort({ submittedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Registration.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: items,
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
  });
});

export const getRegistration = asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdParam(req, 'id');
  if (!id) {
    res.status(400).json({ error: 'Invalid registration id' });
    return;
  }

  const registration = await Registration.findById(id).lean();
  if (!registration) {
    res.status(404).json({ error: 'Registration not found' });
    return;
  }

  const tickets = await Ticket.find({ registrationId: id })
    .select('ticketId session status isCheckedIn checkedInAt emailedAt emailAttempts lastEmailError')
    .lean();

  res.status(200).json({ success: true, data: { registration, tickets } });
});

export const getRegistrationStats = asyncHandler(async (_req: Request, res: Response) => {
  const [byStatus, byTier, totals] = await Promise.all([
    Registration.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Registration.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$tier', count: { $sum: 1 } } },
    ]),
    Registration.aggregate<{ _id: null; expectedTickets: number }>([
      { $match: { status: 'APPROVED', tier: { $ne: 'MERCH_ONLY' } } },
      { $group: { _id: null, expectedTickets: { $sum: { $size: '$sessions' } } } },
    ]),
  ]);

  const [issuedTickets, emailedTickets, manualTickets, manualEmailedTickets] = await Promise.all([
    Ticket.countDocuments({ registrationId: { $ne: null } }),
    Ticket.countDocuments({ registrationId: { $ne: null }, emailedAt: { $ne: null } }),
    Ticket.countDocuments({ registrationId: null }),
    Ticket.countDocuments({ registrationId: null, emailedAt: { $ne: null } }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      byStatus: Object.fromEntries(byStatus.map((row) => [row._id, row.count])),
      byTier: Object.fromEntries(byTier.map((row) => [row._id, row.count])),
      expectedTickets: totals[0]?.expectedTickets ?? 0,
      issuedTickets,
      emailedTickets,
      manualTickets,
      manualEmailedTickets,
      sheetsConfigured: isSheetsConfigured(),
      sheetsMode: sheetsMode(),
    },
  });
});

export const syncSheet = asyncHandler(async (_req: Request, res: Response) => {
  if (!isSheetsConfigured()) {
    res.status(400).json({
      error:
        'Google Sheets is not connected. Set GOOGLE_SHEETS_ID (plus GOOGLE_SHEETS_GID for a specific tab). Share the sheet publicly, or add a service account for private access.',
    });
    return;
  }

  try {
    const result = await syncFromGoogleSheet();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sheet sync failed';
    res.status(502).json({ error: message });
  }
});

export const importRows = asyncHandler(async (req: Request, res: Response) => {
  const parsed = parseWith(importSchema, req.body);
  if (!parsed.ok) {
    respondInvalid(res, parsed.issues);
    return;
  }
  const result = await syncRegistrations(parsed.data.rows);
  res.status(200).json({ success: true, data: result });
});

export const updateRegistration = asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdParam(req, 'id');
  if (!id) {
    res.status(400).json({ error: 'Invalid registration id' });
    return;
  }
  const parsed = parseWith(updateSchema, req.body);
  if (!parsed.ok) {
    respondInvalid(res, parsed.issues);
    return;
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.email) {
    update.email = parsed.data.email.toLowerCase();
    update.emailSource = 'MANUAL';
  }
  if (parsed.data.reviewNotes !== undefined) {
    update.reviewNotes = parsed.data.reviewNotes;
  }
  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  const registration = await Registration.findByIdAndUpdate(id, { $set: update }, { returnDocument: 'after' });
  if (!registration) {
    res.status(404).json({ error: 'Registration not found' });
    return;
  }

  if (parsed.data.email) {
    await Registration.updateOne({ _id: id }, { $pull: { flags: 'NO_EMAIL' } });
  }

  res.status(200).json({ success: true, data: registration });
});

const applyDecision = async (
  req: Request,
  res: Response,
  status: 'APPROVED' | 'REJECTED'
): Promise<void> => {
  const id = objectIdParam(req, 'id');
  if (!id) {
    res.status(400).json({ error: 'Invalid registration id' });
    return;
  }
  const parsed = parseWith(decisionSchema, req.body ?? {});
  if (!parsed.ok) {
    respondInvalid(res, parsed.issues);
    return;
  }

  const registration = await Registration.findByIdAndUpdate(
    id,
    {
      $set: {
        status,
        reviewedBy: getPrincipalObjectId(req),
        reviewedAt: new Date(),
        reviewNotes: parsed.data.notes ?? null,
      },
    },
    { returnDocument: 'after' }
  );

  if (!registration) {
    res.status(404).json({ error: 'Registration not found' });
    return;
  }

  res.status(200).json({ success: true, data: registration });
};

export const approveRegistration = asyncHandler((req, res) => applyDecision(req, res, 'APPROVED'));
export const rejectRegistration = asyncHandler((req, res) => applyDecision(req, res, 'REJECTED'));

export const bulkApprove = asyncHandler(async (req: Request, res: Response) => {
  const parsed = parseWith(bulkDecisionSchema, req.body);
  if (!parsed.ok) {
    respondInvalid(res, parsed.issues);
    return;
  }

  const ids = parsed.data.registrationIds
    .map((value) => toObjectId(value))
    .filter((value): value is NonNullable<typeof value> => value !== null);

  if (ids.length === 0) {
    res.status(400).json({ error: 'No valid registration ids supplied' });
    return;
  }

  const outcome = await Registration.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        status: 'APPROVED',
        reviewedBy: getPrincipalObjectId(req),
        reviewedAt: new Date(),
        reviewNotes: parsed.data.notes ?? null,
      },
    }
  );

  res.status(200).json({ success: true, data: { approved: outcome.modifiedCount } });
});

const AUTO_SYNC_MIN_INTERVAL_MS = 20_000;
const WEBHOOK_MIN_INTERVAL_MS = 5_000;

export const getSyncState = asyncHandler(async (_req: Request, res: Response) => {
  const status = await getSyncStatus();
  res.status(200).json({
    success: true,
    data: { ...status, mode: sheetsMode(), configured: isSheetsConfigured() },
  });
});

export const autoSync = asyncHandler(async (_req: Request, res: Response) => {
  if (!isSheetsConfigured()) {
    res.status(200).json({ success: true, data: { ran: false, reason: 'NOT_CONFIGURED' } });
    return;
  }
  try {
    const outcome = await syncIfStale(AUTO_SYNC_MIN_INTERVAL_MS, 'admin-portal');
    res.status(200).json({ success: true, data: outcome });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sheet sync failed';
    res.status(200).json({ success: true, data: { ran: false, reason: message } });
  }
});

export const sheetWebhook = asyncHandler(async (req: Request, res: Response) => {
  const secret = env.SHEET_WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'Webhook is not enabled. Set SHEET_WEBHOOK_SECRET.' });
    return;
  }

  const provided = req.get('x-sheet-secret') ?? '';
  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  const authorised =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!authorised) {
    res.status(401).json({ error: 'Invalid webhook secret' });
    return;
  }

  if (!isSheetsConfigured()) {
    res.status(503).json({ error: 'Google Sheets is not connected' });
    return;
  }

  try {
    const outcome = await syncIfStale(WEBHOOK_MIN_INTERVAL_MS, 'form-submit');
    res.status(200).json({ success: true, data: outcome });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sheet sync failed';
    res.status(502).json({ error: message });
  }
});

export const purgeRemovedRegistrations = asyncHandler(async (_req: Request, res: Response) => {
  const deleted = await purgeRemoved();
  res.status(200).json({ success: true, data: { deleted } });
});
