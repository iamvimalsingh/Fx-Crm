import crypto from 'crypto';
import { Pool } from 'pg';
import { AdminAuditLog } from '../types';

let pgPool: Pool | null = null;
export function setTradingAuditDbPool(pool: Pool | null) {
  pgPool = pool;
}

const memoryAuditLogs: AdminAuditLog[] = [];

export class AuditService {
  public static async log(entry: {
    adminUserId: string;
    action: string;
    targetAccountId?: string;
    targetObjectId?: string;
    tenantId: string;
    requestReference?: string;
    previousState?: any;
    newState?: any;
    payloadMetadata?: any;
    success?: boolean;
    errorCode?: string;
  }): Promise<AdminAuditLog> {
    // Sanitize any potential secret leakage
    const sanitizedMetadata = entry.payloadMetadata ? this.sanitize(entry.payloadMetadata) : undefined;
    const sanitizedPrev = entry.previousState ? this.sanitize(entry.previousState) : undefined;
    const sanitizedNew = entry.newState ? this.sanitize(entry.newState) : undefined;

    const logRecord: AdminAuditLog = {
      id: crypto.randomUUID(),
      admin_user_id: entry.adminUserId || 'crm_system_m2m',
      action: entry.action,
      target_account_id: entry.targetAccountId,
      target_object_id: entry.targetObjectId,
      tenant_id: entry.tenantId || 'default',
      request_reference: entry.requestReference,
      previous_state: sanitizedPrev,
      new_state: sanitizedNew,
      payload_metadata: sanitizedMetadata,
      success: entry.success !== undefined ? entry.success : true,
      error_code: entry.errorCode,
      created_at: new Date(),
    };

    memoryAuditLogs.push(logRecord);

    if (pgPool) {
      try {
        await pgPool.query(
          `INSERT INTO public.trading_admin_audit_logs
           (id, admin_user_id, action, target_account_id, target_object_id, tenant_id, request_reference, previous_state, new_state, payload_metadata, success, error_code, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            logRecord.id,
            logRecord.admin_user_id,
            logRecord.action,
            logRecord.target_account_id,
            logRecord.target_object_id,
            logRecord.tenant_id,
            logRecord.request_reference,
            logRecord.previous_state ? JSON.stringify(logRecord.previous_state) : null,
            logRecord.new_state ? JSON.stringify(logRecord.new_state) : null,
            logRecord.payload_metadata ? JSON.stringify(logRecord.payload_metadata) : null,
            logRecord.success,
            logRecord.error_code,
            logRecord.created_at,
          ]
        );
      } catch (err) {
        // Fallback to memory
      }
    }

    return logRecord;
  }

  public static getMemoryLogs(targetAccountId?: string): AdminAuditLog[] {
    if (!targetAccountId) return [...memoryAuditLogs];
    return memoryAuditLogs.filter((l) => l.target_account_id === targetAccountId);
  }

  public static clearMemoryLogs() {
    memoryAuditLogs.length = 0;
  }

  private static sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const cloned = Array.isArray(obj) ? [...obj] : { ...obj };
    const sensitiveKeys = ['secret', 'signature', 'token', 'password', 'key', 'auth', 'authorization', 'crm_m2m_secret'];
    for (const k of Object.keys(cloned)) {
      if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
        cloned[k] = '[REDACTED]';
      } else if (typeof cloned[k] === 'object' && cloned[k] !== null) {
        cloned[k] = this.sanitize(cloned[k]);
      }
    }
    return cloned;
  }
}
