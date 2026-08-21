import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Admin } from '../model/admin.model.js';

export const loginAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
//     console.log("Admin Object Found:", admin);
// console.log("Password from body:", password);
// console.log("Hash from DB:", (admin as any).password);

    const isMatch = await bcrypt.compare(password, (admin as any).password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not defined");

    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      secret,
      { expiresIn: '12h' }
    );

    // Set HttpOnly Cookie.
    // In production the frontend (Vercel) and backend (Render) are on different
    // sites, so the auth cookie must be SameSite=None + Secure to be sent on
    // cross-site requests. Locally we stay on 'lax'/insecure so it works on http.
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProd, // required when sameSite is 'none'
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });

    return res.status(200).json({ success: true, message: "Logged in successfully", role: admin.role });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const logoutAdmin = (req: Request, res: Response) => {
  // Attributes must match the ones used when setting the cookie, otherwise the
  // browser won't clear a SameSite=None; Secure cookie.
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
  return res.status(200).json({ success: true, message: "Logged out successfully" });
};