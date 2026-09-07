import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Admin } from '../model/admin.model.js';
import { env } from '../../../config/env.js';
import { AUTH_COOKIE_NAME, buildAuthCookieOptions } from '../../../config/cookie.js';
import { asyncHandler } from '../../../shared/http.js';

const credentialsSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export const loginAdmin = asyncHandler(async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const account = await Admin.findOne({ email });

  if (!account || !(await bcrypt.compare(parsed.data.password, account.password))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (!account.isActive) {
    res.status(403).json({ error: 'This account has been deactivated. Contact an admin.' });
    return;
  }

  const token = jwt.sign(
    { id: account._id.toString(), email: account.email, role: account.role },
    env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  await Admin.updateOne({ _id: account._id }, { $set: { lastLoginAt: new Date() } });

  res.cookie(AUTH_COOKIE_NAME, token, buildAuthCookieOptions());
  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    role: account.role,
    allowedSessions: account.allowedSessions,
    name: account.name,
  });
});

export const logoutAdmin = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, buildAuthCookieOptions());
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});
