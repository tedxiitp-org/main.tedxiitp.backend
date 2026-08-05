import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type { ErrorCode } from '../../types/index.js';

export const LoginSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export function validateLogin(req: Request, res: Response, next: NextFunction): void {
  const result = LoginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION-ERROR' as ErrorCode,
        message: result.error.issues[0]?.message ?? 'Validation-failed',
      },
    });
    return;
  }

  // Replace req.body with the perfectly typed data
  req.body = result.data;
  next();
}