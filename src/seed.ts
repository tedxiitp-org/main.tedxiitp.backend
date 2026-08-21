import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { Admin } from './features/qr/model/admin.model.js';
import { Counter } from './features/qr/model/counter.model.js';

// Load env (no-op on hosts like Render where vars come from the environment).
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Create the account if missing, otherwise update its password + role.
// (Upsert, so re-seeding with new SEED_* values actually applies them — the
// old version skipped existing accounts and silently kept the old password.)
const upsertUser = async (
  email: string,
  password: string,
  role: 'ADMIN' | 'VOLUNTEER'
) => {
  const passwordHash = await bcrypt.hash(password, 10);
  await Admin.findOneAndUpdate(
    { email },
    { $set: { password: passwordHash, role } },
    { upsert: true, new: true }
  );
  console.log(`Seeded ${role}: ${email}`);
};

/**
 * Core seeding logic. Assumes an active mongoose connection. Safe to import
 * and call from the server (does NOT connect or call process.exit).
 */
export const seedDatabase = async () => {
  // Ticket sequence counters — create at 0 only if missing (never reset).
  for (const key of ['ticket_sequence_81', 'ticket_sequence_82']) {
    await Counter.findOneAndUpdate(
      { key },
      { $setOnInsert: { sequence: 0 } },
      { upsert: true }
    );
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD');
  }
  await upsertUser(adminEmail, adminPassword, 'ADMIN');

  // Optional bootstrap volunteers from env. These are upserted (so their
  // passwords stay in sync with the env) but we DO NOT prune anything else:
  // volunteers the admin creates at runtime must survive server restarts.
  const volunteerEmailsRaw = process.env.SEED_VOLUNTEER_EMAILS;
  const volunteerPassword = process.env.SEED_VOLUNTEER_PASSWORD;
  if (volunteerEmailsRaw && volunteerPassword) {
    const emails = volunteerEmailsRaw
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    for (const email of emails) {
      await upsertUser(email, volunteerPassword, 'VOLUNTEER');
    }
  } else {
    console.log('No SEED_VOLUNTEER_EMAILS/PASSWORD set. Skipping volunteers.');
  }

  console.log('Database seeded successfully!');
};

// When run directly (`npx tsx src/seed.ts`): connect, seed, then exit.
// When imported by the server, this block does not run. We detect the entry
// point via argv[1] to stay agnostic to ESM/CJS (avoids import.meta).
const entry = process.argv[1] ?? '';
const isRunDirectly = /[\\/]seed\.(ts|js)$/.test(entry);

if (isRunDirectly) {
  (async () => {
    try {
      const mongoUri = process.env.MONGO_URI;
      if (!mongoUri) throw new Error('MONGO_URI is missing');
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB.');
      await seedDatabase();
      process.exit(0);
    } catch (error) {
      console.error('Seeding failed:', error);
      process.exit(1);
    }
  })();
}
