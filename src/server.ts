import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

// Route & Controller Imports
import qrRoutes from './features/qr/routes/qr.routes.js';
import { loginAdmin, logoutAdmin } from './features/qr/controller/auth.controller.js';
import { BulkJob } from './features/qr/model/bulkjob.model.js';
import { seedDatabase } from './seed.js';

// Load env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;


// FRONTEND_URL may contain one or more comma-separated origins. Trailing
// slashes are stripped because the browser's Origin header never has one, and
// the cors package matches origins by exact string.
// We also strip quotes, BOM, zero-width spaces, and any other non-printable /
// non-ASCII characters that can sneak in from hosting dashboard copy-paste.
const sanitizeOrigin = (raw: string) =>
  raw
    .replace(/[^\x20-\x7E]/g, '')   // keep only printable ASCII
    .replace(/['"]/g, '')            // strip quotes
    .trim()
    .replace(/\/+$/, '');            // strip trailing slashes

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(sanitizeOrigin)
  .filter(Boolean);

console.log('CORS allowed origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (no Origin header) and any whitelisted origin.
    // Refuse others without throwing: the browser blocks the response (no
    // Allow-Origin header) but we avoid emitting a 500 for every bad origin.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true, // CRITICAL: This allows the HttpOnly cookie to be sent to the frontend
}));
app.use(express.json());
app.use(cookieParser());

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { error: "Too many requests, please try again later." }
});
app.use('/api/', apiLimiter);


const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is missing in .env file");
    }
    
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};



// Auth Routes (Public)
app.post('/api/qr/auth/login', loginAdmin);
app.post('/api/qr/auth/logout', logoutAdmin);

// QR Routes 
app.use('/api/qr', qrRoutes);


app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'QR service is running perfectly' });
});


// Connect to the database first, then start listening so the server
// never accepts requests before MongoDB is ready.
connectDB().then(async () => {
  // Seed on every boot from the host's env vars (Render/local .env). This makes
  // the accounts always match the deployment's SEED_* config — set the creds
  // once in the environment and they persist for the entire deployment. The
  // env is the only source of credentials (the app has no password-change
  // feature), so re-applying it on each start is safe and idempotent.
  // Set SEED_ON_BOOT=false to opt out (e.g. to manage accounts another way).
  if (process.env.SEED_ON_BOOT !== 'false') {
    console.log('Seeding database from environment...');
    try {
      await seedDatabase();
    } catch (err) {
      // Don't let a seeding hiccup take down the API.
      console.error('Seed-on-boot failed (continuing without it):', err);
    }
  }

  // Cleanup any stuck BulkJobs from a previous server crash.
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = await BulkJob.updateMany(
      { status: 'PROCESSING', updatedAt: { $lt: fiveMinutesAgo } },
      { $set: { status: 'FAILED' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Cleaned up ${result.modifiedCount} stale bulk jobs.`);
    }
  } catch (err) {
    console.error('Failed to cleanup stale bulk jobs:', err);
  }

  app.listen(PORT, () => {
    console.log(`QR Scanner service running on http://localhost:${PORT}`);
  });
});