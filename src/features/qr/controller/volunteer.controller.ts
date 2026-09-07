import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { Admin } from '../model/admin.model.js';
import { sessionSchema } from '../../../shared/domain.js';
import { asyncHandler, objectIdParam, parseWith, respondInvalid } from '../../../shared/http.js';
import { getPrincipalObjectId } from '../../../shared/principal.js';

const createSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120).optional(),
  allowedSessions: z.array(sessionSchema).max(2).optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  password: z.string().min(8).max(128).optional(),
  isActive: z.boolean().optional(),
  allowedSessions: z.array(sessionSchema).max(2).optional(),
});

const PUBLIC_FIELDS = 'email name role isActive allowedSessions lastLoginAt createdAt';

export const createVolunteer = asyncHandler(async (req: Request, res: Response) => {
  const parsed = parseWith(createSchema, req.body);
  if (!parsed.ok) {
    respondInvalid(res, parsed.issues);
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await Admin.findOne({ email }).lean();
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const volunteer = await Admin.create({
    email,
    password: await bcrypt.hash(parsed.data.password, 10),
    name: parsed.data.name ?? null,
    role: 'VOLUNTEER',
    isActive: true,
    allowedSessions: parsed.data.allowedSessions ?? [],
    createdBy: getPrincipalObjectId(req),
  });

  res.status(201).json({
    success: true,
    data: {
      id: volunteer._id.toString(),
      email: volunteer.email,
      name: volunteer.name,
      role: volunteer.role,
      isActive: volunteer.isActive,
      allowedSessions: volunteer.allowedSessions,
    },
  });
});

export const listVolunteers = asyncHandler(async (_req: Request, res: Response) => {
  const volunteers = await Admin.find({ role: 'VOLUNTEER' })
    .select(PUBLIC_FIELDS)
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: volunteers });
});

export const updateVolunteer = asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdParam(req, 'id');
  if (!id) {
    res.status(400).json({ error: 'Invalid volunteer id' });
    return;
  }
  const parsed = parseWith(updateSchema, req.body);
  if (!parsed.ok) {
    respondInvalid(res, parsed.issues);
    return;
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.isActive !== undefined) update.isActive = parsed.data.isActive;
  if (parsed.data.allowedSessions !== undefined) update.allowedSessions = parsed.data.allowedSessions;
  if (parsed.data.password) update.password = await bcrypt.hash(parsed.data.password, 10);

  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  const volunteer = await Admin.findOneAndUpdate(
    { _id: id, role: 'VOLUNTEER' },
    { $set: update },
    { returnDocument: 'after' }
  ).select(PUBLIC_FIELDS);

  if (!volunteer) {
    res.status(404).json({ error: 'Volunteer not found' });
    return;
  }

  res.status(200).json({ success: true, data: volunteer });
});

export const deleteVolunteer = asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdParam(req, 'id');
  if (!id) {
    res.status(400).json({ error: 'Invalid volunteer id' });
    return;
  }

  const outcome = await Admin.deleteOne({ _id: id, role: 'VOLUNTEER' });
  if (outcome.deletedCount === 0) {
    res.status(404).json({ error: 'Volunteer not found' });
    return;
  }

  res.status(200).json({ success: true });
});
