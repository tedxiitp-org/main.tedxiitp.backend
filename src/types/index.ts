import type { Request } from 'express';
import 'express-session';

import type { IAdmin } from '../features/auth/admin.model.js';

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
  user?: IAdmin;
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