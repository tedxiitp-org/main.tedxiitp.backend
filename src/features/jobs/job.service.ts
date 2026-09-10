import { randomUUID } from 'node:crypto';
import type { Types } from 'mongoose';
import { Job, JobItem } from './job.model.js';
import type { IJob, IJobItem } from './job.model.js';
import { Registration } from '../registrations/registration.model.js';
import { issueTicket, deliverTicket } from '../qr/service/issuance.service.js';
import type { Session } from '../../shared/domain.js';

const DEFAULT_BUDGET_MS = 25_000;
const MAX_BUDGET_MS = 120_000;
const DEFAULT_THROTTLE_MS = 1_200;
const MAX_ATTEMPTS = 5;
const LEASE_MS = 60_000;
const STUCK_ITEM_MS = 5 * 60_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const backoffFor = (attempts: number): Date =>
  new Date(Date.now() + Math.min(2 ** attempts * 30_000, 15 * 60_000));

export interface CreateJobInput {
  label: string;
  createdBy: Types.ObjectId;
  registrationIds: Types.ObjectId[];
}

export interface CreateJobResult {
  job: IJob;
  itemsCreated: number;
  registrationsSkipped: number;
}

export const createJob = async (input: CreateJobInput): Promise<CreateJobResult> => {
  const registrations = await Registration.find({
    _id: { $in: input.registrationIds },
    status: 'APPROVED',
  })
    .select('_id email name sessions')
    .lean();

  const pairs = registrations.flatMap((registration) =>
    registration.sessions.map((session) => ({
      registrationId: registration._id,
      session: session as Session,
      email: registration.email,
      name: registration.name,
    }))
  );

  if (pairs.length === 0) {
    throw new Error('No approved registrations with sessions were selected');
  }

  const job = await Job.create({
    label: input.label,
    createdBy: input.createdBy,
    status: 'PENDING',
    totalItems: pairs.length,
  });

  await JobItem.insertMany(
    pairs.map((pair) => ({
      jobId: job._id,
      registrationId: pair.registrationId,
      session: pair.session,
      email: pair.email,
      name: pair.name,
      status: 'PENDING',
    })),
    { ordered: false }
  );

  return {
    job,
    itemsCreated: pairs.length,
    registrationsSkipped: input.registrationIds.length - registrations.length,
  };
};

export interface PumpResult {
  jobId: string;
  status: IJob['status'];
  processedThisPump: number;
  succeeded: number;
  alreadyIssued: number;
  failed: number;
  skipped: number;
  remaining: number;
  done: boolean;
}

const releaseStuckItems = async (jobId: Types.ObjectId): Promise<void> => {
  await JobItem.updateMany(
    {
      jobId,
      status: 'PROCESSING',
      claimedAt: { $lt: new Date(Date.now() - STUCK_ITEM_MS) },
    },
    { $set: { status: 'PENDING', claimedAt: null } }
  );
};

const claimNextItem = async (jobId: Types.ObjectId): Promise<IJobItem | null> =>
  JobItem.findOneAndUpdate(
    { jobId, status: 'PENDING', nextAttemptAt: { $lte: new Date() } },
    { $set: { status: 'PROCESSING', claimedAt: new Date() }, $inc: { attempts: 1 } },
    { returnDocument: 'after', sort: { _id: 1 } }
  );

const processItem = async (
  item: IJobItem
): Promise<{ status: IJobItem['status']; ticketId: string | null; error: string | null }> => {
  const registration = await Registration.findById(item.registrationId)
    .select('email name transactionId status')
    .lean();

  if (!registration) {
    return { status: 'SKIPPED', ticketId: null, error: 'Registration no longer exists' };
  }
  if (registration.status !== 'APPROVED') {
    return { status: 'SKIPPED', ticketId: null, error: 'Registration is not approved' };
  }
  if (!registration.email) {
    return { status: 'SKIPPED', ticketId: null, error: 'Registration has no email address' };
  }

  const issuance = await issueTicket({
    registrationId: item.registrationId,
    email: registration.email,
    name: registration.name,
    transactionId: registration.transactionId,
    session: item.session,
  });

  if (issuance.kind === 'FAILED') {
    return { status: 'FAILED', ticketId: null, error: issuance.reason };
  }

  const ticket = issuance.ticket;
  if (issuance.kind === 'ALREADY_ISSUED' && ticket.emailedAt) {
    return { status: 'ALREADY_ISSUED', ticketId: ticket.ticketId, error: null };
  }

  if (issuance.kind === 'ISSUED') {
    await Registration.updateOne({ _id: item.registrationId }, { $inc: { ticketsIssued: 1 } });
  }

  const delivery = await deliverTicket(ticket);
  if (delivery.kind === 'SENT') {
    return {
      status: issuance.kind === 'ISSUED' ? 'SENT' : 'ALREADY_ISSUED',
      ticketId: ticket.ticketId,
      error: null,
    };
  }
  if (delivery.kind === 'SKIPPED') {
    return { status: 'SKIPPED', ticketId: ticket.ticketId, error: delivery.reason };
  }
  return { status: 'FAILED', ticketId: ticket.ticketId, error: delivery.reason };
};

export const pumpJob = async (
  jobId: Types.ObjectId,
  budgetMs: number = DEFAULT_BUDGET_MS,
  throttleMs: number = DEFAULT_THROTTLE_MS
): Promise<PumpResult> => {
  const budget = Math.min(Math.max(budgetMs, 1_000), MAX_BUDGET_MS);
  const owner = randomUUID();
  const now = new Date();

  const job = await Job.findOneAndUpdate(
    {
      _id: jobId,
      status: { $in: ['PENDING', 'RUNNING'] },
      $or: [{ leaseExpiresAt: null }, { leaseExpiresAt: { $lt: now } }],
    },
    {
      $set: {
        status: 'RUNNING',
        leaseOwner: owner,
        leaseExpiresAt: new Date(Date.now() + LEASE_MS),
        lastPumpAt: now,
      },
    },
    { returnDocument: 'after' }
  );

  if (!job) {
    const current = await Job.findById(jobId).lean();
    if (!current) {
      throw new Error('Job not found');
    }
    const remaining = await JobItem.countDocuments({ jobId, status: 'PENDING' });
    return {
      jobId: jobId.toString(),
      status: current.status,
      processedThisPump: 0,
      succeeded: current.succeeded,
      alreadyIssued: current.alreadyIssued,
      failed: current.failed,
      skipped: current.skipped,
      remaining,
      done: current.status === 'COMPLETED' || current.status === 'CANCELLED',
    };
  }

  await releaseStuckItems(job._id);

  const startedAt = Date.now();
  let processedThisPump = 0;
  let exhausted = false;

  while (Date.now() - startedAt < budget) {
    const item = await claimNextItem(job._id);
    if (!item) {
      exhausted = true;
      break;
    }

    const outcome = await processItem(item);
    const isRetryableFailure = outcome.status === 'FAILED' && item.attempts < MAX_ATTEMPTS;

    await JobItem.updateOne(
      { _id: item._id },
      {
        $set: {
          status: isRetryableFailure ? 'PENDING' : outcome.status,
          ticketId: outcome.ticketId,
          error: outcome.error,
          claimedAt: null,
          nextAttemptAt: isRetryableFailure ? backoffFor(item.attempts) : item.nextAttemptAt,
        },
      }
    );

    if (!isRetryableFailure) {
      const counterField =
        outcome.status === 'SENT'
          ? 'succeeded'
          : outcome.status === 'ALREADY_ISSUED'
            ? 'alreadyIssued'
            : outcome.status === 'SKIPPED'
              ? 'skipped'
              : 'failed';
      await Job.updateOne({ _id: job._id }, { $inc: { processed: 1, [counterField]: 1 } });
    }

    processedThisPump += 1;

    await Job.updateOne(
      { _id: job._id },
      { $set: { leaseExpiresAt: new Date(Date.now() + LEASE_MS) } }
    );

    if (outcome.status === 'SENT' && throttleMs > 0) {
      await sleep(throttleMs);
    }
  }

  const remaining = await JobItem.countDocuments({
    jobId: job._id,
    status: { $in: ['PENDING', 'PROCESSING'] },
  });
  const done = exhausted && remaining === 0;

  const updated = await Job.findOneAndUpdate(
    { _id: job._id },
    {
      $set: {
        status: done ? 'COMPLETED' : 'RUNNING',
        leaseOwner: null,
        leaseExpiresAt: null,
        completedAt: done ? new Date() : null,
      },
    },
    { returnDocument: 'after' }
  );

  return {
    jobId: job._id.toString(),
    status: updated?.status ?? 'RUNNING',
    processedThisPump,
    succeeded: updated?.succeeded ?? 0,
    alreadyIssued: updated?.alreadyIssued ?? 0,
    failed: updated?.failed ?? 0,
    skipped: updated?.skipped ?? 0,
    remaining,
    done,
  };
};

export const retryFailedItems = async (jobId: Types.ObjectId): Promise<number> => {
  const outcome = await JobItem.updateMany(
    { jobId, status: 'FAILED' },
    { $set: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), error: null } }
  );
  if (outcome.modifiedCount > 0) {
    await Job.updateOne(
      { _id: jobId },
      {
        $set: { status: 'RUNNING', completedAt: null },
        $inc: { failed: -outcome.modifiedCount, processed: -outcome.modifiedCount },
      }
    );
  }
  return outcome.modifiedCount;
};

export const cancelJob = async (jobId: Types.ObjectId): Promise<void> => {
  await Job.updateOne(
    { _id: jobId },
    { $set: { status: 'CANCELLED', leaseOwner: null, leaseExpiresAt: null } }
  );
};
