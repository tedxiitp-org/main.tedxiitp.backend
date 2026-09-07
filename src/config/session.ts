import session from 'express-session';
import MongoStore from 'connect-mongo';
import type { RequestHandler } from 'express';
import { env } from './env.js';
import { SESSION_COOKIE_NAME, buildSessionCookieOptions } from './cookie.js';

export const createSessionMiddleware = (): RequestHandler =>
  session({
    name: SESSION_COOKIE_NAME,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: env.MONGO_URI,
      collectionName: 'admin_sessions',
      ttl: 7 * 24 * 60 * 60,
    }),
    cookie: buildSessionCookieOptions(),
  });
