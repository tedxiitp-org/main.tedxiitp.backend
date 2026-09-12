import { Ticket } from '../model/ticket.model.js';
import type { ITicket } from '../model/ticket.model.js';
import { sessionCode } from '../../../shared/domain.js';
import type { Session } from '../../../shared/domain.js';

const SEQUENCE_MIN = 1;
const SEQUENCE_MAX = 9999;
const SEQUENCE_WIDTH = 4;
const MAX_ID_ATTEMPTS = 8;
const DUPLICATE_KEY_ERROR = 11000;

export type TicketDraft = Pick<
  ITicket,
  | 'ticketId'
  | 'registrationId'
  | 'email'
  | 'name'
  | 'userId'
  | 'session'
  | 'transactionId'
  | 'qrToken'
  | 'status'
  | 'isCheckedIn'
>;

export class TicketIdSpaceExhaustedError extends Error {
  constructor(session: Session) {
    super(`No ticket numbers left for ${session}; the ${SEQUENCE_WIDTH}-digit range is full.`);
    this.name = 'TicketIdSpaceExhaustedError';
  }
}

export class TicketIdContentionError extends Error {
  constructor(session: Session) {
    super(`Could not claim a free ticket number for ${session} after ${MAX_ID_ATTEMPTS} attempts.`);
    this.name = 'TicketIdContentionError';
  }
}

const prefixFor = (session: Session): string => `TEDXIITP-26-${sessionCode(session)}-`;

const formatTicketId = (session: Session, sequence: number): string =>
  `${prefixFor(session)}${sequence.toString().padStart(SEQUENCE_WIDTH, '0')}`;

const parseSequence = (ticketId: string, prefix: string): number | null => {
  if (!ticketId.startsWith(prefix)) return null;
  const tail = ticketId.slice(prefix.length);
  if (tail.length !== SEQUENCE_WIDTH || !/^\d+$/.test(tail)) return null;
  const value = Number(tail);
  return value >= SEQUENCE_MIN && value <= SEQUENCE_MAX ? value : null;
};

const claimed = new Map<Session, Set<number>>();
const loading = new Map<Session, Promise<Set<number>>>();

const loadClaimed = async (session: Session): Promise<Set<number>> => {
  const prefix = prefixFor(session);
  const rows = await Ticket.find({ session }).select('ticketId').lean();
  const used = new Set<number>();
  for (const row of rows) {
    const sequence = parseSequence(row.ticketId, prefix);
    if (sequence !== null) used.add(sequence);
  }
  return used;
};

const claimedFor = async (session: Session): Promise<Set<number>> => {
  const cached = claimed.get(session);
  if (cached) return cached;

  const inFlight = loading.get(session);
  if (inFlight) return inFlight;

  const pending = loadClaimed(session)
    .then((used) => {
      claimed.set(session, used);
      loading.delete(session);
      return used;
    })
    .catch((error: unknown) => {
      loading.delete(session);
      throw error;
    });

  loading.set(session, pending);
  return pending;
};

const reserveSequence = async (session: Session): Promise<number> => {
  const used = await claimedFor(session);
  for (let sequence = SEQUENCE_MIN; sequence <= SEQUENCE_MAX; sequence += 1) {
    if (!used.has(sequence)) {
      used.add(sequence);
      return sequence;
    }
  }
  throw new TicketIdSpaceExhaustedError(session);
};

const releaseSequence = (session: Session, sequence: number): void => {
  claimed.get(session)?.delete(sequence);
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const isDuplicateKeyError = (error: unknown): boolean =>
  asRecord(error).code === DUPLICATE_KEY_ERROR;

const isTicketIdConflict = (error: unknown): boolean => {
  if (!isDuplicateKeyError(error)) return false;
  const keys = Object.keys(asRecord(asRecord(error).keyPattern));
  if (keys.length > 0) return keys.includes('ticketId');
  return String(asRecord(error).message ?? '').includes('ticketId');
};

export const allocateTicket = async (
  session: Session,
  build: (ticketId: string) => TicketDraft
): Promise<ITicket> => {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const sequence = await reserveSequence(session);
    try {
      return await Ticket.create(build(formatTicketId(session, sequence)));
    } catch (error) {
      if (isTicketIdConflict(error)) continue;
      releaseSequence(session, sequence);
      throw error;
    }
  }
  throw new TicketIdContentionError(session);
};

export const resetTicketIdCache = (): void => {
  claimed.clear();
  loading.clear();
};
