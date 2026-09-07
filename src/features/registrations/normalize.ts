import { createHash } from 'node:crypto';
import { TSHIRT_SIZES, sessionsForTier, tierIncludesTshirt } from '../../shared/domain.js';
import type { Session, TicketTier, TshirtSize } from '../../shared/domain.js';

export interface NormalizedRegistration {
  sourceHash: string;
  sourceRow: number;
  submittedAt: Date | null;
  name: string;
  email: string | null;
  emailSource: 'EMAIL_COLUMN' | 'ALT_EMAIL_COLUMN' | 'INSTITUTE_ID' | 'UNRESOLVED';
  rollNo: string | null;
  instituteId: string | null;
  ticketTypeRaw: string;
  tier: TicketTier;
  sessions: Session[];
  tshirtSize: TshirtSize | null;
  transactionId: string;
  paymentProofUrl: string | null;
  residesAtIITP: boolean | null;
  aadhaarNumber: string | null;
  aadhaarUrl: string | null;
  address: string | null;
  comments: string | null;
  flags: string[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AADHAAR_FORMATTED = /^\d{4}[\s-]\d{4}[\s-]\d{4}$/;

const clean = (value: string | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();

const normalizeHeader = (header: string): string =>
  header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const findColumns = (headers: string[], predicate: (header: string) => boolean): number[] => {
  const matches: number[] = [];
  headers.forEach((header, index) => {
    if (predicate(normalizeHeader(header))) {
      matches.push(index);
    }
  });
  return matches;
};

export interface ColumnMap {
  timestamp: number[];
  name: number[];
  rollNo: number[];
  ticketType: number[];
  tshirtSize: number[];
  paymentProof: number[];
  transactionId: number[];
  residesAtIITP: number[];
  aadhaarUpload: number[];
  aadhaarNumber: number[];
  instituteId: number[];
  address: number[];
  email: number[];
  comments: number[];
}

export const buildColumnMap = (headers: string[]): ColumnMap => ({
  timestamp: findColumns(headers, (h) => h === 'timestamp'),
  name: findColumns(headers, (h) => h === 'name' || h === 'full name'),
  rollNo: findColumns(headers, (h) => h.startsWith('roll no')),
  ticketType: findColumns(headers, (h) => h.includes('select your ticket') || h === 'ticket'),
  tshirtSize: findColumns(headers, (h) => h.includes('size for t shirt') || h.includes('t shirt size')),
  paymentProof: findColumns(headers, (h) => h.includes('screenshot') && h.includes('payment')),
  transactionId: findColumns(headers, (h) => h.includes('transaction id')),
  residesAtIITP: findColumns(
    headers,
    (h) => h.includes('reside at iit patna') || h.includes('student of iit patna')
  ),
  aadhaarUpload: findColumns(headers, (h) => h.includes('upload aadhaar') || h.includes('upload aadhar')),
  aadhaarNumber: findColumns(
    headers,
    (h) => (h.includes('aadhar') || h.includes('aadhaar')) && !h.includes('upload')
  ),
  instituteId: findColumns(headers, (h) => h.includes('institute id')),
  address: findColumns(headers, (h) => h.startsWith('address')),
  email: findColumns(headers, (h) => h.includes('email')),
  comments: findColumns(headers, (h) => h === 'comments'),
});

const firstValue = (row: string[], indexes: number[]): string => {
  for (const index of indexes) {
    const value = clean(row[index]);
    if (value) return value;
  }
  return '';
};

export const parseTier = (raw: string): TicketTier => {
  const value = raw.toLowerCase();
  if (!value) return 'UNRECOGNIZED';

  const hasTshirt = value.includes('shirt');
  const bundled = value.includes('1+2');
  const hasSession1 = bundled || value.includes('session 1');
  const hasSession2 = bundled || value.includes('session 2');
  const bothSessions = value.includes('both') || (hasSession1 && hasSession2);

  if (bothSessions) return hasTshirt ? 'BOTH_SESSIONS_WITH_TSHIRT' : 'BOTH_SESSIONS';
  if (hasSession1) return 'SESSION_1_ONLY';
  if (hasSession2) return 'SESSION_2_ONLY';
  if (hasTshirt) return 'MERCH_ONLY';
  return 'UNRECOGNIZED';
};

export const parseTshirtSize = (raw: string): TshirtSize | null => {
  const value = raw.toUpperCase().replace(/[^A-Z]/g, '');
  const match = TSHIRT_SIZES.find((size) => size === value);
  return match ?? null;
};

const parseYesNo = (raw: string): boolean | null => {
  const value = raw.toLowerCase();
  if (value.startsWith('y')) return true;
  if (value.startsWith('n')) return false;
  return null;
};

const parseTimestamp = (raw: string): Date | null => {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

interface ResolvedEmail {
  email: string | null;
  source: NormalizedRegistration['emailSource'];
}

const resolveEmail = (row: string[], columns: ColumnMap): ResolvedEmail => {
  for (const index of columns.email) {
    const value = clean(row[index]).toLowerCase();
    if (EMAIL_PATTERN.test(value)) {
      return { email: value, source: 'EMAIL_COLUMN' };
    }
  }

  for (const index of columns.instituteId) {
    const value = clean(row[index]).toLowerCase();
    if (EMAIL_PATTERN.test(value)) {
      return { email: value, source: 'INSTITUTE_ID' };
    }
  }

  for (let index = 0; index < row.length; index += 1) {
    const value = clean(row[index]).toLowerCase();
    if (EMAIL_PATTERN.test(value)) {
      return { email: value, source: 'ALT_EMAIL_COLUMN' };
    }
  }

  return { email: null, source: 'UNRESOLVED' };
};

const buildSourceHash = (submittedAt: Date | null, transactionId: string, name: string, row: number): string => {
  const identity = submittedAt
    ? `${submittedAt.toISOString()}|${transactionId.toLowerCase()}|${name.toLowerCase()}`
    : `row:${row}`;
  return createHash('sha256').update(identity).digest('hex');
};

export const normalizeRow = (
  row: string[],
  columns: ColumnMap,
  sourceRow: number
): NormalizedRegistration | null => {
  const name = firstValue(row, columns.name);
  const ticketTypeRaw = firstValue(row, columns.ticketType);
  const transactionId = firstValue(row, columns.transactionId);
  const submittedAt = parseTimestamp(firstValue(row, columns.timestamp));

  if (!name && !ticketTypeRaw && !transactionId && !submittedAt) {
    return null;
  }

  const tier = parseTier(ticketTypeRaw);
  const sessions = sessionsForTier(tier);
  const resolved = resolveEmail(row, columns);
  const instituteId = firstValue(row, columns.instituteId);
  const tshirtSize = parseTshirtSize(firstValue(row, columns.tshirtSize));

  const flags: string[] = [];
  if (tier === 'UNRECOGNIZED') flags.push('UNRECOGNIZED_TICKET_TYPE');
  if (tier === 'MERCH_ONLY') flags.push('MERCH_ONLY_NO_ENTRY');
  if (!resolved.email) flags.push('NO_EMAIL');
  if (!transactionId) flags.push('NO_TRANSACTION_ID');
  if (transactionId && AADHAAR_FORMATTED.test(transactionId)) {
    flags.push('TRANSACTION_ID_LOOKS_LIKE_AADHAAR');
  }
  if (tierIncludesTshirt(tier) && !tshirtSize) flags.push('MISSING_TSHIRT_SIZE');

  return {
    sourceHash: buildSourceHash(submittedAt, transactionId, name, sourceRow),
    sourceRow,
    submittedAt,
    name,
    email: resolved.email,
    emailSource: resolved.source,
    rollNo: firstValue(row, columns.rollNo) || null,
    instituteId: instituteId || null,
    ticketTypeRaw,
    tier,
    sessions,
    tshirtSize,
    transactionId,
    paymentProofUrl: firstValue(row, columns.paymentProof) || null,
    residesAtIITP: parseYesNo(firstValue(row, columns.residesAtIITP)),
    aadhaarNumber: firstValue(row, columns.aadhaarNumber) || null,
    aadhaarUrl: firstValue(row, columns.aadhaarUpload) || null,
    address: firstValue(row, columns.address) || null,
    comments: firstValue(row, columns.comments) || null,
    flags,
  };
};

export const normalizeSheet = (rows: string[][]): NormalizedRegistration[] => {
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return [];
  const columns = buildColumnMap(headerRow);

  const normalized: NormalizedRegistration[] = [];
  dataRows.forEach((row, index) => {
    const result = normalizeRow(row, columns, index + 2);
    if (result) {
      normalized.push(result);
    }
  });
  return normalized;
};
