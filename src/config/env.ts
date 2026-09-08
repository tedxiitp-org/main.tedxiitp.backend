import dotenv from 'dotenv';
import { z } from 'zod';

try {
  dotenv.config();
} catch {
  /* hosting providers inject env directly */
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5001').transform((value) => Number.parseInt(value, 10)),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  SUPERADMIN_EMAIL: z.email('SUPERADMIN_EMAIL must be a valid email').optional(),
  SUPERADMIN_PASSWORD: z
    .string()
    .min(8, 'SUPERADMIN_PASSWORD must be at least 8 characters')
    .optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587').transform((value) => Number.parseInt(value, 10)),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('TEDxIITPatna <no-reply@tedxiitpatna.iitp.ac.in>'),
  SHEET_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_SHEETS_ID: z.string().optional(),
  GOOGLE_SHEETS_RANGE: z.string().default('Form Responses 1'),
  GOOGLE_SHEETS_GID: z.string().default('0'),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

export type EnvValidation =
  | { ok: true; env: Env }
  | { ok: false; missing: string[] };

const buildValidation = (): EnvValidation => {
  if (parsed.success) {
    return { ok: true, env: parsed.data };
  }
  const missing = parsed.error.issues.map((issue) => {
    const key = issue.path.join('.');
    return key ? `${key}: ${issue.message}` : issue.message;
  });
  return { ok: false, missing };
};

export const envValidation = buildValidation();

if (!envValidation.ok) {
  console.error('Invalid environment configuration:');
  for (const entry of envValidation.missing) {
    console.error(`  - ${entry}`);
  }
}

const unavailable = (): never => {
  const detail = envValidation.ok ? '' : ` Missing: ${envValidation.missing.join('; ')}`;
  throw new Error(`Environment configuration is invalid.${detail}`);
};

export const env: Env = parsed.success
  ? parsed.data
  : (new Proxy({} as Env, { get: unavailable }) as Env);

export const isEnvValid = envValidation.ok;
