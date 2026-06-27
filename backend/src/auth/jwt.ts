import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';

const SECRET = new TextEncoder().encode(config.jwtSecret);
const ISSUER = 'aixuan';
const EXPIRES_IN = '7d';

export interface JwtPayload {
  sub: string;
  email?: string;
}

/**
 * 签发 JWT
 */
export async function signToken(userId: string, email?: string): Promise<string> {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET);
}

/**
 * 验证 JWT，返回 payload 或 null
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  if (!config.jwtSecret) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER });
    return {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
    };
  } catch {
    return null;
  }
}