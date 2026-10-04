import jwt from 'jsonwebtoken';
import { UserRecord, inMemoryDb, getPool, query } from '../db/client';

export class JwtConfigurationError extends Error {
  constructor(message: string = 'JWT_SECRET is not configured. Authentication cannot proceed.') {
    super(message);
    this.name = 'JwtConfigurationError';
  }
}

export class CrmLaunchSecretConfigurationError extends Error {
  constructor(message: string = 'CRM_LAUNCH_SECRET is not configured. Trading launch token issuance cannot proceed.') {
    super(message);
    this.name = 'CrmLaunchSecretConfigurationError';
  }
}

const JWT_EXPIRES_IN = '7d';
const TRADING_LAUNCH_TOKEN_EXPIRES_IN = '5m';

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

/**
 * Validates and retrieves the dedicated CRM_LAUNCH_SECRET used exclusively
 * for signing short-lived CRM -> Trading Engine launch session tokens.
 * Strictly separated from the general CRM JWT_SECRET.
 */
export function getCrmLaunchSecret(): string {
  const rawSecret = process.env.CRM_LAUNCH_SECRET;
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.APP_ENV === 'production' ||
    process.env.NETLIFY === 'true' ||
    process.env.CONTEXT === 'production';

  if (!rawSecret || rawSecret.trim() === '') {
    if (isProd) {
      throw new CrmLaunchSecretConfigurationError(
        'CRM_LAUNCH_SECRET is not configured in production environment. Trading launch token issuance is disabled.'
      );
    }
    // Explicit automated test mode & development fallback
    if (process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true' || process.env.NODE_ENV === 'development') {
      return 'test_only_crm_launch_secret_distinct_from_jwt_secret_32chars!';
    }
    throw new CrmLaunchSecretConfigurationError('CRM_LAUNCH_SECRET is required.');
  }

  if (isProd && rawSecret.length < 32) {
    throw new CrmLaunchSecretConfigurationError(
      'CRM_LAUNCH_SECRET must be at least 32 characters in production to guarantee cryptographic security.'
    );
  }

  return rawSecret;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'client' | 'admin';
}

export interface TradingLaunchTokenPayload {
  // Canonical required claims
  iss: 'crm-backend';
  sub: string;
  aud: 'trading-terminal';
  accountId: string;
  accountNumber: string;
  tenantId: string;

  // Optional supported claims
  platform: string;
  currency: string;
  accountType: string;
  leverage: number;
  initialBalance?: number;
  balance?: number;

  // Backward-compatible claims for existing consumers
  clientId: string;
  userId: string;
  serverName?: string;
  email?: string;
  type: 'trading_session';

  iat?: number;
  exp?: number;
}

export type TradingSsoTokenPayload = TradingLaunchTokenPayload;

export function parseNumericLeverage(raw: string | number | null | undefined): number {
  if (typeof raw === 'number' && !isNaN(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === 'string') {
    const cleaned = raw.trim();
    if (cleaned.startsWith('1:')) {
      const parsed = parseInt(cleaned.slice(2), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const parsed = parseInt(cleaned, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 100;
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

export function generateTradingLaunchToken(
  user: Pick<UserRecord, 'id' | 'email' | 'role'>,
  account: {
    id: string;
    account_number: string;
    server_name?: string | null;
    currency?: string | null;
    platform?: string | null;
    account_type?: string | null;
    leverage?: string | number | null;
    balance?: string | number | null;
  },
  tenantId: string = 'default'
): string {
  const secret = getCrmLaunchSecret();
  const numericLeverage = parseNumericLeverage(account.leverage);
  const parsedBalance =
    account.balance !== undefined && account.balance !== null
      ? parseFloat(String(account.balance))
      : undefined;
  const canonicalBalance =
    parsedBalance !== undefined && !isNaN(parsedBalance) ? parsedBalance : 0;
  const initialBalNum = canonicalBalance;

  const payload: TradingLaunchTokenPayload = {
    // Canonical required claims
    iss: 'crm-backend',
    sub: String(user.id),
    aud: 'trading-terminal',
    accountId: account.id,
    accountNumber: account.account_number,
    tenantId: tenantId || 'default',

    // Optional supported claims
    platform: account.platform || 'MT5',
    currency: account.currency || 'USD',
    accountType: account.account_type || 'standard',
    leverage: numericLeverage,
    balance: canonicalBalance,
    initialBalance: initialBalNum,

    // Backward-compatible claims for verified existing consumers
    clientId: String(user.id),
    userId: String(user.id),
    serverName: account.server_name || undefined,
    email: user.email,
    type: 'trading_session',
  };

  return jwt.sign(payload, secret, { expiresIn: TRADING_LAUNCH_TOKEN_EXPIRES_IN });
}

export function generateTradingSsoToken(
  user: Pick<UserRecord, 'id' | 'email' | 'role'>,
  accountInfo?: {
    accountId?: string;
    accountNumber?: string;
    serverName?: string;
    currency?: string;
    platform?: string;
    accountType?: string;
    leverage?: string | number | null;
    balance?: string | number | null;
  },
  tenantId: string = 'default'
): string {
  return generateTradingLaunchToken(
    user,
    {
      id: accountInfo?.accountId || 'default',
      account_number: accountInfo?.accountNumber || 'default',
      server_name: accountInfo?.serverName,
      currency: accountInfo?.currency,
      platform: accountInfo?.platform,
      account_type: accountInfo?.accountType,
      leverage: accountInfo?.leverage,
      balance: accountInfo?.balance,
    },
    tenantId
  );
}

export function verifyTradingLaunchToken(token: string): TradingLaunchTokenPayload | null {
  try {
    const secret = getCrmLaunchSecret();
    return jwt.verify(token, secret) as TradingLaunchTokenPayload;
  } catch {
    return null;
  }
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
