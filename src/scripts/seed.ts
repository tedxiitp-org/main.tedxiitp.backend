import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { Admin } from '../features/auth/admin.model.js';import { AdminRole } from '../types/index.js';

async function seedAdmin() {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('DB connected.');

    const email = env.SUPERADMIN_EMAIL;
    
    // prevent duplicating the user
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      console.log('Admin already exists in the DB.');
      process.exit(0);
    }

    // hash the password 
    const hashedPassword = await bcrypt.hash(env.SUPERADMIN_PASSWORD, 12);

    await Admin.create({
      name: 'Admin',
      email: email,
      hashedPassword: hashedPassword,
      role: AdminRole.SuperAdmin,
      isActive: true,
    });

    console.log('SuperAdmin successfully created!');
    process.exit(0);

  } catch (error) {
    console.error('Failed to seed DB:', error);
    process.exit(1);
  }
}

seedAdmin();