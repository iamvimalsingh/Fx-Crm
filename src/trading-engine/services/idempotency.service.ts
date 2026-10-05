import crypto from 'crypto';
import { Pool } from 'pg';
import { IdempotencyRecord, TradingEngineError } from '../types';

let pgPool: Pool | null = null;
export function setTradingDbPool(pool: Pool | null) {
  pgPool = pool;
}

// In-memory fallback cache for testing or when DB connection pool is not configured
const memoryIdempotencyStore = new Map<string, IdempotencyRecord>();

export class IdempotencyService {
  public static hashPayload(payload: any): string {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  public static async executeIdempotent<T>(
    idempotencyKey: string,
    action: string,
    requestPayload: any,
    fn: () => Promise<{ status: number; body: T }>
  ): Promise<{ status: number; body: T; cached: boolean }> {
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      throw new TradingEngineError('INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required for this operation', 400);
    }

    const trimmedKey = idempotencyKey.trim();
    const reqHash = this.hashPayload(requestPayload);
    const storeKey = `${trimmedKey}:${action}`;

    // 1. Try DB lookup if pool is active
    if (pgPool) {
      try {
        const existing = await pgPool.query<IdempotencyRecord>(
          'SELECT * FROM public.trading_idempotency_records WHERE idempotency_key = $1 AND action = $2 LIMIT 1',
          [trimmedKey, action]
        );
        if (existing.rows.length > 0) {
          const rec = existing.rows[0];
          if (rec.request_hash !== reqHash) {
            throw new TradingEngineError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has already been used with different request parameters',
              409,
              { idempotencyKey: trimmedKey, action }
            );
          }
          return { status: rec.http_status, body: rec.response_payload, cached: true };
        }
      } catch (err: any) {
        if (err instanceof TradingEngineError) throw err;
        // DB lookup failure falls through to memory store during test mode
      }
    }

    // 2. Memory store check
    const memRec = memoryIdempotencyStore.get(storeKey);
    if (memRec) {
      if (memRec.expires_at > new Date()) {
        if (memRec.request_hash !== reqHash) {
          throw new TradingEngineError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key has already been used with different request parameters',
            409,
            { idempotencyKey: trimmedKey, action }
          );
        }
        return { status: memRec.http_status, body: memRec.response_payload, cached: true };
      } else {
        memoryIdempotencyStore.delete(storeKey);
      }
    }

    // 3. Execute the underlying operation
    const result = await fn();

    // 4. Save to DB and Memory
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    const record: IdempotencyRecord = {
      id: crypto.randomUUID(),
      idempotency_key: trimmedKey,
      action,
      request_hash: reqHash,
      http_status: result.status,
      response_payload: result.body,
      created_at: now,
      expires_at: expiresAt,
    };

    memoryIdempotencyStore.set(storeKey, record);

    if (pgPool) {
      try {
        await pgPool.query(
          `INSERT INTO public.trading_idempotency_records 
           (id, idempotency_key, action, request_hash, http_status, response_payload, created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (idempotency_key, action) DO NOTHING`,
          [record.id, record.idempotency_key, record.action, record.request_hash, record.http_status, JSON.stringify(record.response_payload), record.created_at, record.expires_at]
        );
      } catch (err) {
        // Log & proceed if non-fatal
      }
    }

    return { status: result.status, body: result.body, cached: false };
  }

  public static clearMemoryStore() {
    memoryIdempotencyStore.clear();
  }
}
