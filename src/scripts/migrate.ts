import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Registration } from '../features/registrations/registration.model.js';
import { Ticket } from '../features/qr/model/ticket.model.js';
import { Job, JobItem } from '../features/jobs/job.model.js';
import { Admin } from '../features/qr/model/admin.model.js';
import { Attendance } from '../features/qr/model/attendance.model.js';

const models = [
  { name: 'Registration', model: Registration },
  { name: 'Ticket', model: Ticket },
  { name: 'Job', model: Job },
  { name: 'JobItem', model: JobItem },
  { name: 'Account', model: Admin },
  { name: 'Attendance', model: Attendance },
];

const run = async (): Promise<void> => {
  await mongoose.connect(env.MONGO_URI);

  for (const entry of models) {
    await entry.model.syncIndexes();
    console.log(`Synced indexes for ${entry.name}`);
  }

  const legacy = await Ticket.updateMany(
    { emailAttempts: { $exists: false } },
    { $set: { emailAttempts: 0, emailedAt: null, lastEmailError: null, registrationId: null } }
  );
  console.log(`Backfilled ${legacy.modifiedCount} legacy tickets`);

  const accounts = await Admin.updateMany(
    { isActive: { $exists: false } },
    { $set: { isActive: true, allowedSessions: [], name: null, createdBy: null, lastLoginAt: null } }
  );
  console.log(`Backfilled ${accounts.modifiedCount} accounts`);

  await mongoose.disconnect();
};

run().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
