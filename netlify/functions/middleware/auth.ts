import jwt from 'jsonwebtoken';
import { UserRecord, inMemoryDb, getPool, query } from '../db/client';

export class JwtConfigurationError extends Error {
  constructor(message: string = 'JWT_SECRET is not configured. Authentication cannot proceed.') {
    super(message);
    this.name = 'JwtConfigurationError';
  }
}

const JWT_EXPIRES_IN = '7d';

/**
 * Validates and retrieves the JWT signing secret.
 * In production, it NEVER falls back to any default secret.
 */
export function getJwtSecret(): string {
  const rawSecret = process.env.JWT_SECRET;
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.APP_ENV === 'production' ||
    process.env.NETLIFY === 'true' ||
    process.env.CONTEXT === 'production';

  if (!rawSecret || rawSecret.trim() === '') {
    if (isProd) {
      throw new JwtConfigurationError(
        'JWT_SECRET is not configured in production environment. Authentication and token issuance are disabled.'
      );
    }
    // Only in explicit automated test mode
    if (process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      return 'test_only_isolated_ephemeral_jwt_secret_do_not_use_in_production_32chars!';
    }
    throw new JwtConfigurationError('JWT_SECRET is required.');
  }

  if (isProd && rawSecret.length < 32) {
    throw new JwtConfigurationError(
      'JWT_SECRET must be at least 32 characters in production to guarantee cryptographic security.'
    );
  }

  return rawSecret;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'client' | 'admin';
}

export function generateToken(user: Pick<UserRecord, 'id' | 'email' | 'role'>): string {
  const secret = getJwtSecret();
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret) as TokenPayload;
  } catch {
    return null;
  }
}

export async function authenticateRequest(authHeader?: string | null): Promise<UserRecord | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  if (getPool()) {
    const users = await query<UserRecord>('SELECT * FROM users WHERE id = $1 AND status = $2', [
      payload.userId,
      'active',
    ]);
    return users[0] || null;
  }

  // Test mode in-memory fallback ONLY (guarded by inMemoryDb proxy)
  const user = Array.from(inMemoryDb.users.values()).find((u) => u.id === payload.userId);
  if (user && user.status === 'active') {
    return user;
  }

  return null;
}
