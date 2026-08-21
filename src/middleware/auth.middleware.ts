import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';


export const requireAuth = (req: Request, res: Response, next: NextFunction): any => {
  try {
    // read the cookie named 'auth_token'
    const token = req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No session found. Please log in." });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is missing");

    // Decrypt the token
    const decoded = jwt.verify(token, secret);
    
   
    (req as any).user = decoded;

    next(); // pass control to the next function
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired session." });
  }
};


export const requireAdmin = (req: Request, res: Response, next: NextFunction): any => {

  const user = (req as any).user;
  
  // verify the role
  if (user && user.role === 'ADMIN') {
    next(); 
  } else {
    // 403 Forbidden
    return res.status(403).json({ error: "Access Denied: Admin privileges required." });
  }
};