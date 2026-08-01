import dotenv from 'dotenv';
import { z } from 'zod';

// load env
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  // db
  MONGO_URI: z.string().url({ message: 'MONGO_URI must be a valid connection string' }),
  // security 
  JWT_SECRET: z.string().min(16, { message: 'JWT_SECRET must be at least 16 characters' }),
  SESSION_SECRET: z.string().min(16, { message: 'SESSION_SECRET must be at least 16 characters' }),
  
  // Admin Credentials
  SUPERADMIN_EMAIL: z.string().email({ message: 'SUPERADMIN_EMAIL must be a valid email' }),
  SUPERADMIN_PASSWORD: z.string().min(8, { message: 'SUPERADMIN_PASSWORD must be at least 8 characters' }),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid env detected on boot:');
  console.error(parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
