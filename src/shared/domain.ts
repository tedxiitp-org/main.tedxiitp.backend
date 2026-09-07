import { z } from 'zod';

export const SESSIONS = ['SESSION_1', 'SESSION_2'] as const;
export const sessionSchema = z.enum(SESSIONS);
export type Session = z.infer<typeof sessionSchema>;

export const TICKET_TIERS = [
  'SESSION_1_ONLY',
  'SESSION_2_ONLY',
  'BOTH_SESSIONS',
  'BOTH_SESSIONS_WITH_TSHIRT',
  'MERCH_ONLY',
  'UNRECOGNIZED',
] as const;
export const ticketTierSchema = z.enum(TICKET_TIERS);
export type TicketTier = z.infer<typeof ticketTierSchema>;

export const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export const tshirtSizeSchema = z.enum(TSHIRT_SIZES);
export type TshirtSize = z.infer<typeof tshirtSizeSchema>;

export const REGISTRATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'DUPLICATE',
] as const;
export const registrationStatusSchema = z.enum(REGISTRATION_STATUSES);
export type RegistrationStatus = z.infer<typeof registrationStatusSchema>;

export const EMAIL_SOURCES = [
  'EMAIL_COLUMN',
  'ALT_EMAIL_COLUMN',
  'INSTITUTE_ID',
  'MANUAL',
  'UNRESOLVED',
] as const;
export const emailSourceSchema = z.enum(EMAIL_SOURCES);
export type EmailSource = z.infer<typeof emailSourceSchema>;

export const JOB_STATUSES = [
  'PENDING',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
] as const;
export const jobStatusSchema = z.enum(JOB_STATUSES);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const JOB_ITEM_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SENT',
  'ALREADY_ISSUED',
  'FAILED',
  'SKIPPED',
] as const;
export const jobItemStatusSchema = z.enum(JOB_ITEM_STATUSES);
export type JobItemStatus = z.infer<typeof jobItemStatusSchema>;

export const ACCOUNT_ROLES = ['ADMIN', 'VOLUNTEER'] as const;
export const accountRoleSchema = z.enum(ACCOUNT_ROLES);
export type AccountRole = z.infer<typeof accountRoleSchema>;

export const VALIDATION_STATUSES = [
  'SUCCESS',
  'FAILED_DUPLICATE',
  'FAILED_REVOKED',
  'FAILED_INVALID',
  'FAILED_WRONG_SESSION',
  'FAILED_SESSION_NOT_ALLOWED',
] as const;
export const validationStatusSchema = z.enum(VALIDATION_STATUSES);
export type ValidationStatus = z.infer<typeof validationStatusSchema>;

export const TICKET_STATUSES = ['ACTIVE', 'REVOKED', 'USED'] as const;
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const sessionsForTier = (tier: TicketTier): Session[] => {
  switch (tier) {
    case 'SESSION_1_ONLY':
      return ['SESSION_1'];
    case 'SESSION_2_ONLY':
      return ['SESSION_2'];
    case 'BOTH_SESSIONS':
    case 'BOTH_SESSIONS_WITH_TSHIRT':
      return ['SESSION_1', 'SESSION_2'];
    case 'MERCH_ONLY':
    case 'UNRECOGNIZED':
      return [];
    default: {
      const exhaustive: never = tier;
      return exhaustive;
    }
  }
};

export const tierIncludesTshirt = (tier: TicketTier): boolean =>
  tier === 'BOTH_SESSIONS_WITH_TSHIRT' || tier === 'MERCH_ONLY';

export const tierGrantsEntry = (tier: TicketTier): boolean => sessionsForTier(tier).length > 0;

export const sessionCode = (session: Session): string =>
  session === 'SESSION_1' ? '81' : '82';

export const sessionLabel = (session: Session): string =>
  session === 'SESSION_1' ? 'Session 1' : 'Session 2';
