import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest, JwtPayload, SuccessResponse } from '../../../types/index.js';
import { signToken } from '../../../services/token.service.js';
import { Admin } from '../admin.model.js';
import type { IAdmin } from '../admin.model.js';
import { AUTH_COOKIE_NAME, SESSION_COOKIE_NAME, buildAuthCookieOptions } from '../../../config/cookie.js';

// login handeler
// Runs after Passport has verified credentials and called req.logIn()
export async function loginHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest; 
  const admin = authReq.user as IAdmin;

  const payload: JwtPayload = {
    id: admin.id,
    email: admin.email,
    role: admin.role,
  };

  const token = signToken(payload);

  // Update last login timestamp
  void Admin.findByIdAndUpdate(admin.id, { lastLoginAt: new Date() });

  //secure httponly cookie containing the jwt
  res.cookie(AUTH_COOKIE_NAME, token, buildAuthCookieOptions());

  const body: SuccessResponse<Omit<IAdmin, 'hashedPassword'>> = {
    success: true,
    message: 'Login successful',
    data: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
    } as unknown as Omit<IAdmin, 'hashedPassword'>,
  };

  res.status(200).json(body);
}

// me handeler : returns the currently auth. admin

export async function meHandler(
  req: Request,
  res: Response
): Promise<void> {
  const authReq = req as AuthenticatedRequest; 
  const admin = authReq.user as IAdmin | undefined;

  res.status(200).json({
    success: true,
    data: admin ?? authReq.admin,
  });
}

// logout handeler: destroys sessions and cookies

export function logoutHandler(
  req: Request, 
  res: Response
): void {
  const authReq = req as AuthenticatedRequest; 

  authReq.logout((err: unknown) => {
    if (err) {
       console.error('Logout error:', err);
    }
    authReq.session?.destroy(() => {
      res.clearCookie(AUTH_COOKIE_NAME);
      res.clearCookie(SESSION_COOKIE_NAME);
      
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });
}