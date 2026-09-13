/**
 * In-Memory Sliding Window Rate Limiter for Serverless / Netlify Environments
 * Protects sensitive endpoints (login, registration, password resets) against brute-force and credential stuffing.
 */

interface RateLimitRecord {
  timestamps: number[];
}

class RateLimiter {
  private store: Map<string, RateLimitRecord> = new Map();
  private lastCleanup = Date.now();

  /**
   * Evaluates if a request from an IP on a specific route action is permitted.
   * @param ip Client IP address
   * @param action Route action identifier (e.g., 'login', 'register')
   * @param maxRequests Maximum requests allowed within windowMs
   * @param windowMs Time window in milliseconds (default: 60,000 ms = 1 minute)
   */
  public check(
    ip: string,
    action: string,
    maxRequests: number,
    windowMs: number = 60000
  ): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    this.cleanupIfNecessary(now);

    const key = `${action}:${ip || 'unknown_ip'}`;
    const record = this.store.get(key) || { timestamps: [] };

    // Filter out timestamps outside the sliding window
    const windowStart = now - windowMs;
    const activeTimestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (activeTimestamps.length >= maxRequests) {
      const oldestActive = activeTimestamps[0];
      const retryAfterSeconds = Math.ceil((oldestActive + windowMs - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      };
    }

    activeTimestamps.push(now);
    record.timestamps = activeTimestamps;
    this.store.set(key, record);

    return {
      allowed: true,
      remaining: maxRequests - activeTimestamps.length,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Resets rate limit counters (useful for unit testing or test suites)
   */
  public reset(): void {
    this.store.clear();
  }

  private cleanupIfNecessary(now: number): void {
    // Periodic sweep every 5 minutes
    if (now - this.lastCleanup > 300000) {
      this.lastCleanup = now;
      const oneHourAgo = now - 3600000;
      for (const [key, record] of this.store.entries()) {
        const fresh = record.timestamps.filter((ts) => ts > oneHourAgo);
        if (fresh.length === 0) {
          this.store.delete(key);
        } else {
          record.timestamps = fresh;
        }
      }
    }
  }
}

export const rateLimiter = new RateLimiter();
