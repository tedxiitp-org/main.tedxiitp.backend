import type { CookieOptions } from 'express';
import { env } from './env.js';

export const AUTH_COOKIE_NAME = 'auth_token';
export const SESSION_COOKIE_NAME = 'sid';

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days in ms
};