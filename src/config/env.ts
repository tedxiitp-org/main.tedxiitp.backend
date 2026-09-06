import dotenv from 'dotenv';
import { z } from 'zod';

// load env safely (environment variables are injected directly by hosting provider in production)
try {
  dotenv.config();
} catch (e) {
  // Ignore in serverless environments where .env file is omitted
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  CLIENT_URL: z.string().optional().default('http://localhost:3000'),
  // db
  MONGO_URI: z.string().url({ message: 'MONGO_URI must be a valid connection string' }),
  // security 
  JWT_SECRET: z.string().min(16, { message: 'JWT_SECRET must be at least 16 characters' }),
  SESSION_SECRET: z.string().min(16, { message: 'SESSION_SECRET must be at least 16 characters' }),
  
  // Admin Credentials — only read by the manual seed script (src/scripts/seed.ts),
  // never by the running API, so they must stay optional here. Requiring them
  // took the whole serverless function down on boot when they weren't set.
  SUPERADMIN_EMAIL: z.string().email({ message: 'SUPERADMIN_EMAIL must be a valid email' }).optional(),
  SUPERADMIN_PASSWORD: z.string().min(8, { message: 'SUPERADMIN_PASSWORD must be at least 8 characters' }).optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid env detected on boot:');
  console.error(parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
