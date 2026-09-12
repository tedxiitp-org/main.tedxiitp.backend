import type { Request, Response } from 'express';
import { z } from 'zod';
import { Job, JobItem } from './job.model.js';
import {
  cancelJob,
  createJob,
  previewBatch,
  pumpJob,
  retryFailedItems,
} from './job.service.js';
import { Registration } from '../registrations/registration.model.js';
import { jobItemStatusSchema } from '../../shared/domain.js';
import { asyncHandler, objectIdParam, parseWith, respondInvalid, toObjectId } from '../../shared/http.js';
import { getPrincipalObjectId } from '../../shared/principal.js';
import { timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { isEmailConfigured } from '../qr/service/email.service.js';

const createSchema = z
  .object({
    label: z.string().trim().min(1).max(120).default('Ticket batch'),
    registrationIds: z.array(z.string()).min(1).max(2000).optional(),
    allApproved: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.registrationIds?.length) || value.allApproved === true, {
    message: 'Provide registrationIds or set allApproved to true',
  });

const pumpSchema = z.object({
  budgetMs: z.coerce.number().int().min(1000).max(60000).optional(),
  throttleMs: z.coerce.number().int().min(0).max(10000).optional(),
  concurrency: z.coerce.number().int().min(1).max(8).optional(),
});

const itemsQuerySchema = z.object({
  status: jobItemStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
});

export const createTicketJob = asyncHandler(async (req: Request, res: Response) => {
  const parsed = parseWith(createSchema, req.body ?? {});
  if (!parsed.ok) {
    respondInvalid(res, parsed.issues);
    return;
  }

  if (!isEmailConfigured()) {
    res.status(400).json({
      error: 'Email is not configured. Set SMTP_HOST before starting a batch, or tickets would be created without being delivered.',
    });
    return;
  }

  const active = await Job.findOne({ status: { $in: ['PENDING', 'RUNNING'] } }).lean();
  if (active) {
    res.status(409).json({
      error: 'Another batch is already running. Finish or cancel it first.',
      jobId: active._id.toString(),
    });
    return;
  }

  let registrationIds = (parsed.data.registrationIds ?? [])
    .map((value) => toObjectId(value))
    .filter((value): value is NonNullable<typeof value> => value !== null);

  if (parsed.data.allApproved) {
    const approved = await Registration.find({ status: 'APPROVED' }).select('_id').lean();
    registrationIds = approved.map((row) => row._id);
  }

  if (registrationIds.length === 0) {
    res.status(400).json({ error: 'No approved registrations were selected' });
    return;
  }

  try {
    const result = await createJob({
      label: parsed.data.label,
      createdBy: getPrincipalObjectId(req),
      registrationIds,
    });
    res.status(201).json({
      success: true,
      data: {
        jobId: result.job._id.toString(),
        totalItems: result.itemsCreated,
        alreadyDelivered: result.alreadyDelivered,
        missingEmail: result.missingEmail,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create batch';
    res.status(400).json({ error: message });
  }
});

export const pumpTicketJob = asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdParam(req, 'id');
  if (!id) {
    res.status(400).json({ error: 'Invalid job id' });
    return;
  }
  const parsed = parseWith(pumpSchema, req.body ?? {});
  if (!parsed.ok) {
    respondInvalid(res, parsed.issues);
    return;
  }

  try {
    const result = await pumpJob(
      id,
      parsed.data.budgetMs,
      parsed.data.throttleMs,
      parsed.data.concurrency
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Batch step failed';
    res.status(404).json({ error: message });
  }
});

export const listJobs = asyncHandler(async (_req: Request, res: Response) => {
  const jobs = await Job.find().sort({ createdAt: -1 }).limit(25).lean();
  res.status(200).json({ success: true, data: jobs });
});

export const getJob = asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdParam(req, 'id');
  if (!id) {
    res.status(400).json({ error: 'Invalid job id' });
    return;
  }
  const parsed = parseWith(itemsQuerySchema, req.query);
  if (!parsed.ok) {
    respondInvalid(res, parsed.issues);
    return;
  }

  const job = await Job.findById(id).lean();
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const filter: Record<string, unknown> = { jobId: id };
  if (parsed.data.status) filter.status = parsed.data.status;

  const [items, total] = await Promise.all([
    JobItem.find(filter)
      .sort({ _id: 1 })
      .skip((parsed.data.page - 1) * parsed.data.pageSize)
      .limit(parsed.data.pageSize)
      .lean(),
    JobItem.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: { job, items },
    pagination: { page: parsed.data.page, pageSize: parsed.data.pageSize, total },
  });
});

export const retryJobFailures = asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdParam(req, 'id');
  if (!id) {
    res.status(400).json({ error: 'Invalid job id' });
    return;
  }
  const requeued = await retryFailedItems(id);
  res.status(200).json({ success: true, data: { requeued } });
});

export const cancelTicketJob = asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdParam(req, 'id');
  if (!id) {
    res.status(400).json({ error: 'Invalid job id' });
    return;
  }
  await cancelJob(id);
  res.status(200).json({ success: true });
});

const approvedRegistrationIds = async (): Promise<Types.ObjectId[]> => {
  const approved = await Registration.find({ status: 'APPROVED' }).select('_id').lean();
  return approved.map((row) => row._id);
};

export const previewTicketBatch = asyncHandler(async (_req: Request, res: Response) => {
  const preview = await previewBatch(await approvedRegistrationIds());
  res.status(200).json({ success: true, data: preview });
});

export const pumpActiveJob = asyncHandler(async (req: Request, res: Response) => {
  const secret = env.JOB_RUNNER_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'Job runner is not enabled. Set JOB_RUNNER_SECRET.' });
    return;
  }

  const provided = req.get('x-runner-secret') ?? '';
  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    res.status(401).json({ error: 'Invalid runner secret' });
    return;
  }

  const job = await Job.findOne({ status: { $in: ['PENDING', 'RUNNING'] } })
    .sort({ createdAt: 1 })
    .lean();

  if (!job) {
    res.status(200).json({ success: true, data: { idle: true } });
    return;
  }

  const result = await pumpJob(job._id);
  res.status(200).json({ success: true, data: result });
});
