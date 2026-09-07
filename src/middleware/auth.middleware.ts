import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Admin } from '../features/qr/model/admin.model.js';
import { AUTH_COOKIE_NAME } from '../config/cookie.js';
import { accountRoleSchema, sessionSchema } from '../shared/domain.js';
import type { Session } from '../shared/domain.js';

interface TokenClaims {
  id: string;
  email: string;
  role: string;
}

const readClaims = (token: string): TokenClaims | null => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== 'object' || decoded === null) return null;
    const payload = decoded as Record<string, unknown>;
    const id = typeof payload.id === 'string' ? payload.id : null;
    const email = typeof payload.email === 'string' ? payload.email : null;
    const role = typeof payload.role === 'string' ? payload.role : null;
    if (!id || !email || !role) return null;
    return { id, email, role };
  } catch {
    return null;
  }
};

export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: no active session. Please sign in.' });
    return;
  }

  const claims = readClaims(token);
  if (!claims) {
    res.status(401).json({ error: 'Unauthorized: invalid or expired session.' });
    return;
  }

  const account = await Admin.findById(claims.id)
    .select('email role isActive allowedSessions')
    .lean();

  if (!account || !account.isActive) {
    res.status(401).json({ error: 'Unauthorized: this account is no longer active.' });
    return;
  }

  const role = accountRoleSchema.safeParse(account.role);
  if (!role.success) {
    res.status(401).json({ error: 'Unauthorized: account role is invalid.' });
    return;
  }

  const allowedSessions = (account.allowedSessions ?? []).filter(
    (value): value is Session => sessionSchema.safeParse(value).success
  );

  req.principal = {
    id: account._id.toString(),
    email: account.email,
    role: role.data,
    allowedSessions,
  };

  next();
};

export const requireAdmin: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (req.principal?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Access denied: admin privileges required.' });
    return;
  }
  next();
};

export const canScanSession = (
  principal: { role: string; allowedSessions: Session[] },
  session: Session
): boolean => {
  if (principal.role === 'ADMIN') return true;
  if (principal.allowedSessions.length === 0) return true;
  return principal.allowedSessions.includes(session);
};
