import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest, AdminRole, ErrorCode } from '../types/index.js';
import type { IAdmin } from '../features/auth/admin.model.js';

export function authorize(...roles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as unknown as AuthenticatedRequest;
    // Role from session or cookie
    const role = (authReq.user as IAdmin | undefined)?.role ?? authReq.admin?.role;

    if (!role || !roles.includes(role as AdminRole)) {
      res.status(403).json({
        success: false,
        error: { 
          code: 'FORBIDDEN' as ErrorCode, 
          message: 'Insufficient permissions.' 
        },
      });
      return;
    }

    next();
  };
}