import pg from 'pg';
import { StorageService } from '../services/storage.service';

export class DatabaseConfigurationError extends Error {
  constructor(message: string = 'DATABASE_URL is not configured. Production environment requires a PostgreSQL database.') {
    super(message);
    this.name = 'DatabaseConfigurationError';
  }
}

export class DatabaseConnectionError extends Error {
  constructor(message: string = 'PostgreSQL database connection failed. Live database is unreachable.') {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

export class DatabaseSecurityError extends Error {
  constructor(message: string = 'In-memory database fallback is strictly prohibited in production. A configured PostgreSQL database is required.') {
    super(message);
    this.name = 'DatabaseSecurityError';
  }
}

export class DatabaseGuard {
  /**
   * Identifies if runtime is executing in a production environment
   */
  public static isProduction(): boolean {
    return (
      process.env.NODE_ENV === 'production' ||
      process.env.APP_ENV === 'production' ||
      process.env.NETLIFY === 'true' ||
      process.env.CONTEXT === 'production'
    );
  }

  /**
   * Identifies if runtime is explicitly authorized test or local development mode
   */
  public static isTestMode(): boolean {
    if (this.isProduction()) {
      return false;
    }
    return process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true';
  }

  /**
   * Validates whether DATABASE_URL is configured
   */
  public static isDatabaseConfigured(): boolean {
    const url = process.env.DATABASE_URL;
    return Boolean(url && url.trim().length > 0);
  }

  /**
   * Hard stop: Fails safely and immediately if database is missing in production
   */
  public static assertDatabaseConfigured(): void {
    if (!this.isDatabaseConfigured()) {
      if (!this.isTestMode()) {
        throw new DatabaseConfigurationError(
          'DATABASE_URL is missing or unconfigured. In-memory storage is strictly prohibited in production.'
        );
      }
    }
  }

  /**
   * Hard stop: Prevents in-memory storage access in production under all circumstances
   */
  public static assertInMemoryAllowed(): void {
    if (this.isProduction() || !this.isTestMode()) {
      throw new DatabaseSecurityError(
        'In-memory database fallback is strictly prohibited in production. A configured PostgreSQL database is required.'
      );
    }
  }

  /**
   * Safe health and configuration diagnostic.
   * Exposes ONLY safe status info and booleans. NEVER returns passwords, connection strings, or secrets.
   */
  public static async getHealthDiagnostic(poolGetter?: () => pg.Pool | null): Promise<{
    status: 'ok' | 'degraded';
    environment: 'production' | 'development' | 'test';
    database: {
      configured: boolean;
      reachable: boolean;
      inMemoryFallbackAllowed: boolean;
    };
    storage: {
      configured: boolean;
    };
    database_configured: 'yes' | 'no';
    database_reachable: 'yes' | 'no';
    storage_configured: 'yes' | 'no';
  }> {
    const configured = this.isDatabaseConfigured();
    let reachable = false;

    if (configured && poolGetter) {
      try {
        const pool = poolGetter();
        if (pool) {
          await pool.query('SELECT 1');
          reachable = true;
        }
      } catch (err: any) {
        console.error('[DATABASE HEALTH CHECK ERROR] Database ping failed:', err.message);
        reachable = false;
      }
    }

    const storageConfigured = StorageService.isConfigured();
    const env = this.isProduction() ? 'production' : this.isTestMode() ? 'test' : 'development';
    const isHealthy = configured ? reachable : this.isTestMode();

    return {
      status: isHealthy ? 'ok' : 'degraded',
      environment: env,
      database: {
        configured,
        reachable,
        inMemoryFallbackAllowed: this.isTestMode(),
      },
      storage: {
        configured: storageConfigured,
      },
      database_configured: configured ? 'yes' : 'no',
      database_reachable: reachable ? 'yes' : 'no',
      storage_configured: storageConfigured ? 'yes' : 'no',
    };
  }
}
