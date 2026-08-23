import type { Request } from 'express';
import type { Session, SessionData } from 'express-session';

import type { IAdmin } from '../features/auth/admin.model.js';

// Augment Express so Passport's session methods are visible on every Request.
// express-session and passport add these at runtime; we mirror that here.
declare module 'express-serve-static-core' {
  interface Request {
    session: Session & Partial<SessionData>;
    isAuthenticated(): boolean;
    isUnauthenticated(): boolean;
    logIn(user: unknown, done: (err: unknown) => void): void;
    logIn(user: unknown, options: unknown, done: (err: unknown) => void): void;
    login(user: unknown, done: (err: unknown) => void): void;
    login(user: unknown, options: unknown, done: (err: unknown) => void): void;
    logout(done: (err: unknown) => void): void;
    logout(options: unknown, done: (err: unknown) => void): void;
    user?: IAdmin;
  }
}

export enum AdminRole {
  SuperAdmin = 'super_admin',
  Admin = 'admin',
  Volunteer = 'volunteer',
}

// Minimal JWT payload stored in the token
export interface JwtPayload {
  id: string;
  email: string;
  role: AdminRole;
}


export interface AuthenticatedRequest extends Request {
  admin?: JwtPayload;
}

// Standardised API response shapes
export interface SuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data?: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
  };
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// All possible error codes from the system specification
export type ErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'UNAUTHENTICATED'
  | 'SESSION_INVALID'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';