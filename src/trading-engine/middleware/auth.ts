import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const TIMESTAMP_TOLERANCE_MS = 60 * 1000; // ±60 seconds
const seenNonces = new Map<string, number>();

// Replay cache cleanup
setInterval(() => {
  const cutoff = Date.now() - TIMESTAMP_TOLERANCE_MS * 2;
  for (const [nonce, ts] of seenNonces.entries()) {
    if (ts < cutoff) seenNonces.delete(nonce);
  }
}, 30000).unref();

export function getM2MSecret(): string {
  const secret = process.env.CRM_M2M_SECRET || process.env.CRM_LAUNCH_SECRET;
  if (!secret || secret.trim().length < 32) {
    if (process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      return 'test_only_crm_m2m_secret_at_least_32_characters_long_for_test!';
    }
    throw new Error('CRM_M2M_SECRET must be configured with at least 32 characters in production.');
  }
  return secret;
}

export function generateCrmM2MSignature(
  secret: string,
  timestamp: number,
  body?: any
): string {
  let bodyStr = '';
  if (body !== undefined && body !== null) {
    bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const payload = `${timestamp}.${bodyStr}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `t=${timestamp},v1=${hmac}`;
}

export function verifyCrmM2MRequest(req: Request, res: Response, next: NextFunction) {
  const sigHeader = (req.headers['x-crm-signature'] || req.headers['X-CRM-Signature']) as string;
  if (!sigHeader) {
    return res.status(401).json({
      status: 'error',
      code: 'MISSING_SIGNATURE',
      message: 'Missing required X-CRM-Signature header',
      timestamp: Date.now(),
    });
  }

  const parts = sigHeader.split(',').reduce((acc: Record<string, string>, item) => {
    const eqIdx = item.indexOf('=');
    if (eqIdx !== -1) {
      const k = item.slice(0, eqIdx).trim();
      const v = item.slice(eqIdx + 1).trim();
      acc[k] = v;
    }
    return acc;
  }, {});

  const timestampStr = parts['t'];
  const signatureHex = parts['v1'];

  if (!timestampStr || !signatureHex) {
    return res.status(401).json({
      status: 'error',
      code: 'MALFORMED_SIGNATURE',
      message: 'Invalid X-CRM-Signature header structure. Expected t=<timestamp>,v1=<signature>',
      timestamp: Date.now(),
    });
  }

  const timestamp = parseInt(timestampStr, 10);
  const now = Date.now();
  if (isNaN(timestamp) || Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_MS) {
    return res.status(403).json({
      status: 'error',
      code: 'TIMESTAMP_OUT_OF_BOUNDS',
      message: 'Request timestamp is outside the permitted ±60 second window',
      timestamp: now,
    });
  }

  // Replay check
  const nonceKey = `${timestamp}_${signatureHex}`;
  if (seenNonces.has(nonceKey)) {
    return res.status(403).json({
      status: 'error',
      code: 'REQUEST_REPLAY',
      message: 'Replay detected: identical signature has already been processed',
      timestamp: now,
    });
  }

  // Canonical payload:
  // GET: `<timestamp>.`
  // Mutations: `<timestamp>.<raw_body>`
  let bodyStr = '';
  if (req.method !== 'GET') {
    if ((req as any).rawBody && typeof (req as any).rawBody === 'string') {
      bodyStr = (req as any).rawBody;
    } else if (req.body && Object.keys(req.body).length > 0) {
      bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
  }
  const canonicalPayload = `${timestamp}.${bodyStr}`;

  let secret = '';
  try {
    secret = getM2MSecret();
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      code: 'AUTH_CONFIGURATION_ERROR',
      message: err.message,
      timestamp: now,
    });
  }

  const expectedHmac = crypto.createHmac('sha256', secret).update(canonicalPayload).digest('hex');

  const expectedBuf = Buffer.from(expectedHmac, 'hex');
  const actualBuf = Buffer.from(signatureHex, 'hex');

  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return res.status(403).json({
      status: 'error',
      code: 'INVALID_SIGNATURE',
      message: 'Cryptographic signature verification failed',
      timestamp: now,
    });
  }

  seenNonces.set(nonceKey, now);
  next();
}
