import session from 'express-session';
import MongoStore from 'connect-mongo';
import { env } from './env.js';
import { SESSION_COOKIE_NAME, cookieOptions } from './cookie.js';

export const sessionMiddleware = session({
  name: SESSION_COOKIE_NAME,
  secret: env.SESSION_SECRET,
  resave: false, 
  saveUninitialized: false, 
  store: MongoStore.create({
    mongoUrl: env.MONGO_URI,
    collectionName: 'admin_sessions',
    // automatically delete expired sessions from the db after 7 days
    ttl: 7 * 24 * 60 * 60, 
  }),
  cookie: cookieOptions,
});