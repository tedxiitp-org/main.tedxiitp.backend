import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { mongoManager } from './db/mongo.js';
import { env, envValidation } from './config/env.js';
import { allowedOrigins, corsOptions } from './config/cors.js';
import { createSessionMiddleware } from './config/session.js';
import passport from './config/passport.js';
import { exampleRoutes } from './features/example/example.routes.js';
import authRoutes from './features/auth/auth.routes.js';
import memoryRoutes from './features/memories/memory.routes.js';
import communityWallRoutes from './features/community-wall/communityWall.routes.js';
import { usersRoutes } from './features/users/users.routes.js';
import { gamesRoutes } from './features/games/games.routes.js';
import { leaderboardRoutes } from './features/leaderboard/leaderboard.routes.js';
import qrRoutes from './features/qr/routes/qr.routes.js';
import registrationRoutes from './features/registrations/registration.routes.js';
import jobRoutes from './features/jobs/job.routes.js';
import { loginAdmin, logoutAdmin } from './features/qr/controller/auth.controller.js';
import { seedDatabase } from './features/qr/seed.js';

const buildConfigErrorApp = (missing: string[]): Express => {
  const app = express();
  app.get('/health', (_req: Request, res: Response) => {
    res.status(503).json({ status: 'misconfigured', missing });
  });
  app.use((_req: Request, res: Response) => {
    res.status(503).json({
      error: 'Server configuration incomplete',
      missing,
    });
  });
  return app;
};

const buildApp = (): Express => {
  const app = express();

  app.set('trust proxy', 1);

  console.log(`CORS allows: ${[...allowedOrigins].join(', ')}`);

  app.use(cors(corsOptions));

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(createSessionMiddleware());
  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use(
    '/api/',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 5000,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again later.' },
    })
  );

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Too many login attempts, please try again later.' },
  });

  let seeded = false;
  app.use(async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      await mongoManager.connect(env.MONGO_URI);
      if (!seeded && env.NODE_ENV !== 'test') {
        seeded = true;
        try {
          await seedDatabase();
        } catch (error) {
          console.error('Seed-on-boot failed:', error);
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/qr/auth/login', authLimiter, loginAdmin);
  app.post('/api/qr/auth/logout', logoutAdmin);

  app.use('/api/v1/example', exampleRoutes);
  app.use('/api/memories', memoryRoutes);
  app.use('/api/community-wall', communityWallRoutes);
  app.use('/api/v1/community-wall', communityWallRoutes);
  app.use('/api/wall', communityWallRoutes);
  app.use('/api/v1/wall', communityWallRoutes);
  app.use('/api/admin/auth', authLimiter, authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/games', gamesRoutes);
  app.use('/api/v1/leaderboard', leaderboardRoutes);
  app.use('/api/qr', qrRoutes);
  app.use('/api/registrations', registrationRoutes);
  app.use('/api/jobs', jobRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
};

const app: Express = envValidation.ok ? buildApp() : buildConfigErrorApp(envValidation.missing);

export const startServer = async (): Promise<void> => {
  if (!envValidation.ok) {
    throw new Error(`Environment configuration is invalid: ${envValidation.missing.join('; ')}`);
  }
  await mongoManager.connect(env.MONGO_URI);
  await seedDatabase();
  app.listen(env.PORT, () => {
    console.log(`Server listening on port ${env.PORT}`);
  });
};

export default app;
