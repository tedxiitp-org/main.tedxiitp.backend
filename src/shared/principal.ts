import type { Request } from 'express';
import { Types } from 'mongoose';
import type { AccountRole, Session } from './domain.js';

export interface Principal {
  id: string;
  email: string;
  role: AccountRole;
  allowedSessions: Session[];
}

declare module 'express-serve-static-core' {
  interface Request {
    principal?: Principal;
  }
}

export const getPrincipal = (req: Request): Principal => {
  if (!req.principal) {
    throw new Error('Request is not authenticated');
  }
  return req.principal;
};

export const getPrincipalObjectId = (req: Request): Types.ObjectId =>
  new Types.ObjectId(getPrincipal(req).id);
