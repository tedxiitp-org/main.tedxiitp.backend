import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { findAdminByEmail, findAdminById } from '../features/auth/admin.model.js';
import type { IAdmin } from '../features/auth/admin.model.js';

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      session: true,
    },
    async (email, password, done) => {
      try {
        const admin = await findAdminByEmail(email);

        // run bcrypt even when admin is not found to prevent timing attacks
        const DUMMY_HASH = '$2b$12$invalidhashfortimingprotectiononly00000000000000000000';
        const storedHash = admin?.hashedPassword ?? DUMMY_HASH;
        
        const isMatch = await bcrypt.compare(password, storedHash);

        if (!admin || !isMatch) {
          return done(null, false, { message: 'INVALID_CREDENTIALS' });
        }

        if (!admin.isActive) {
          return done(null, false, { message: 'ACCOUNT_DISABLED' });
        }

        return done(null, admin);
      } catch (err: unknown) {
        return done(err);
      }
    }
  )
);

// admin id in the cookie to keep the browser payload small
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as IAdmin).id as string);
});

// server uses that id to fetch the admin data directly from the database on every new request
passport.deserializeUser(async (id: string, done: (err: unknown, user?: Express.User | false | null) => void) => {
  try {
    const admin = await findAdminById(id);
    done(null, admin ?? false);
  } catch (err: unknown) {
    done(err);
  }
});

export default passport;