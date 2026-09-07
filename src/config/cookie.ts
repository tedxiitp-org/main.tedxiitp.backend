import type { CookieOptions } from 'express';
import { env } from './env.js';

export const AUTH_COOKIE_NAME = 'auth_token';
export const SESSION_COOKIE_NAME = 'sid';

export const AUTH_COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const buildCookieOptions = (maxAge: number): CookieOptions => {
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge,
  };
};

export const buildAuthCookieOptions = (): CookieOptions =>
  buildCookieOptions(AUTH_COOKIE_MAX_AGE_MS);

export const buildSessionCookieOptions = (): CookieOptions =>
  buildCookieOptions(SESSION_COOKIE_MAX_AGE_MS);
