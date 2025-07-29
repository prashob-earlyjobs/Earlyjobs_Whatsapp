import jwt, { SignOptions } from 'jsonwebtoken';

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

export const generateToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET!;
  // Increased to 30 days (30 * 24 * 60 * 60 seconds)
  const expiresIn = process.env.JWT_EXPIRES_IN ? parseInt(process.env.JWT_EXPIRES_IN, 10) : 30 * 24 * 60 * 60;
  
  console.log(`🔐 Generating access token with ${expiresIn} seconds expiry (${expiresIn / (24 * 60 * 60)} days)`);
  
  return jwt.sign(payload, secret, { expiresIn });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!;
  // Increased to 90 days in seconds (90 * 24 * 60 * 60)
  const expiresIn = 90 * 24 * 60 * 60;
  
  console.log(`🔄 Generating refresh token with ${expiresIn} seconds expiry (${expiresIn / (24 * 60 * 60)} days)`);
  
  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!;
  return jwt.verify(token, secret) as TokenPayload;
}; 