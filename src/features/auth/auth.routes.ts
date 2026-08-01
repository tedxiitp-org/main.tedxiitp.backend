import { Router, type Request, type Response, type NextFunction } from 'express';
import passport from '../../config/passport.js';
import { loginHandler, meHandler, logoutHandler } from './controllers/auth.controller.js';
import { validateLogin } from './auth.validator.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loginRateLimit } from '../../middleware/rateLimit.js';
import type { AuthenticatedRequest, ErrorCode } from '../../types/index.js';
import type { IAdmin } from './admin.model.js';

const router = Router();

// POST /api/admin/auth/login
router.post(
  '/login',
  loginRateLimit,
  validateLogin,
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      'local',
      { session: true },
      (err: unknown, admin: IAdmin | false, info?: { message: string }) => {
        if (err) return next(err);
        
        if (!admin) {
          return res.status(401).json({
            success: false,
            error: {
              code: (info?.message ?? 'INVALID_CREDENTIALS') as ErrorCode,
              message: 'Invalid email / password',
            },
          });
        }

        req.logIn(admin, (loginErr: unknown) => {
          if (loginErr) return next(loginErr);
          
        
          return loginHandler(req as AuthenticatedRequest, res, next);
        });
      }
    )(req, res, next);
  }
);

// GET /api/admin/auth/me
router.get('/me', authenticate, meHandler);

// POST /api/admin/auth/logout
router.post('/logout', authenticate, logoutHandler);

export default router;