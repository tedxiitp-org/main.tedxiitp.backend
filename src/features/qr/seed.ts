import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { Admin } from './model/admin.model.js';
import { Counter } from './model/counter.model.js';
import { env } from '../../config/env.js';

export const seedDatabase = async (): Promise<void> => {
  for (const key of ['ticket_sequence_81', 'ticket_sequence_82']) {
    await Counter.findOneAndUpdate({ key }, { $setOnInsert: { sequence: 0 } }, { upsert: true });
  }

  const email = env.SUPERADMIN_EMAIL;
  const password = env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Missing SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD');
  }

  await Admin.findOneAndUpdate(
    { email: email.toLowerCase() },
    {
      $set: { password: await bcrypt.hash(password, 10), role: 'ADMIN', isActive: true },
      $setOnInsert: { name: 'Super Admin', allowedSessions: [] },
    },
    { upsert: true }
  );
};

const entry = process.argv[1] ?? '';
if (/[\\/]seed\.(ts|js)$/.test(entry)) {
  void (async () => {
    try {
      await mongoose.connect(env.MONGO_URI);
      await seedDatabase();
      console.log('Seed complete.');
      process.exit(0);
    } catch (error) {
      console.error('Seeding failed:', error);
      process.exit(1);
    }
  })();
}
