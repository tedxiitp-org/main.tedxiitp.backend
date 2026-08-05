import rateLimit from 'express-rate-limit';
import type { ErrorCode } from '../types/index.js';

export const loginRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE-LIMITED' as ErrorCode,
        message: 'Too many requests. Please try again later.',
        retryAfter: 60,
      },
    });
  },
});