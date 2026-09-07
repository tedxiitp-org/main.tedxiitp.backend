import type { CorsOptions } from 'cors';
import { env } from './env.js';

const KNOWN_ORIGINS = [
  'https://tedxiitpatna.iitp.ac.in',
  'https://www.tedxiitpatna.iitp.ac.in',
  'http://localhost:3000',
  'http://localhost:3001',
];

export const normalizeOrigin = (value: string): string =>
  value
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/['"]/g, '')
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase();

export const buildAllowedOrigins = (clientUrl: string | undefined): Set<string> => {
  const configured = (clientUrl ?? '').split(',');
  return new Set([...configured, ...KNOWN_ORIGINS].map(normalizeOrigin).filter(Boolean));
};

export const allowedOrigins = buildAllowedOrigins(env.CLIENT_URL);

export const isOriginAllowed = (origin: string): boolean =>
  allowedOrigins.has(normalizeOrigin(origin));

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || isOriginAllowed(origin) || env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }
    console.warn(`Blocked cross-origin request from ${origin}`);
    callback(null, false);
  },
  credentials: true,
};
