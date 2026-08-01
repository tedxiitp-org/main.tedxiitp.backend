import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/token.service.js';
import type { AuthenticatedRequest, ErrorCode } from '../types/index.js';
import { AUTH_COOKIE_NAME } from '../config/cookie.js';

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as unknown as AuthenticatedRequest; 

  //Check if Passport session already restored req.user
  if (authReq.isAuthenticated?.() && authReq.user) {
    return next();
  }

  const token = authReq.cookies?.[AUTH_COOKIE_NAME] as string | undefined;

  if (!token) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No active session.' } });
    return;
  }

  try {
    authReq.admin = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session expired / invalid.' } });
  }
}