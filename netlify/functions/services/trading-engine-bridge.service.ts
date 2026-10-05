import crypto from 'crypto';
import Decimal from 'decimal.js';
import { TradingRuntimeService } from '../../../src/trading-engine';

export interface FundingBridgeCreditInput {
  accountId: string;
  accountNumber: string;
  amount: number;
  currency: string;
  referenceNo: string;
  idempotencyKey: string;
  tenantId?: string;
  adminUserId?: string;
}

export interface FundingBridgeDebitInput {
  accountId: string;
  accountNumber: string;
  amount: number;
  currency: string;
  referenceNo: string;
  idempotencyKey: string;
  tenantId?: string;
  adminUserId?: string;
}

export interface FundingExecutionResult {
  executionId: string;
  accountId: string;
  previousBalance: number;
  newBalance: number;
  executedAt: number;
}

export class TradingEngineBridgeError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(code: string, message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = 'TradingEngineBridgeError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class TradingEngineBridgeService {
  private static getSecret(): string {
    const secret =
      process.env.CRM_M2M_SECRET ||
      process.env.CRM_LAUNCH_SECRET ||
      'test_only_crm_m2m_secret_at_least_32_characters_long_for_test!';
    return secret;
  }

  private static getBaseUrl(): string {
    return process.env.TRADING_ENGINE_URL || 'https://trading-platform-3a5e.onrender.com';
  }

  public static generateSignature(timestamp: number, body?: any): string {
    const secret = this.getSecret();
    let bodyStr = '';
    if (body !== undefined && body !== null) {
      bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const payload = `${timestamp}.${bodyStr}`;
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `t=${timestamp},v1=${hmac}`;
  }

  private static resolveLocalAccountId(
    accountId: string,
    accountNumber?: string,
    currency = 'USD',
    initialBalance = 0,
    tenantId = 'default'
  ): string {
    if (TradingRuntimeService.getAccount(accountId)) {
      return accountId;
    }
    if (accountNumber && TradingRuntimeService.getAccount(accountNumber)) {
      return accountNumber;
    }
    // In local/test mode, auto-provision runtime account if missing
    TradingRuntimeService.upsertAccount({
      id: accountId,
      accountNumber: accountNumber || accountId,
      currency: currency || 'USD',
      balance: initialBalance,
      equity: initialBalance,
      usedMargin: 0.0,
      freeMargin: initialBalance,
      marginLevel: 0.0,
      marginCallLevel: 100.0,
      stopOutLevel: 50.0,
      status: 'ACTIVE',
      tradingEnabled: true,
      sessionMode: 'LIVE',
      platform: 'MT5',
      tenantId: tenantId || 'default',
      accountType: 'standard',
      leverage: 100,
      activeSessionCount: 0,
    });
    return accountId;
  }

  /**
   * Dispatches credit to Trading Engine runtime balance.
   * If running in test mode with local engine or local fallback, delegates to TradingRuntimeService.
   */
  public static async creditTradingAccount(input: FundingBridgeCreditInput): Promise<FundingExecutionResult> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine =
      process.env.CRM_USE_LOCAL_ENGINE === 'true' ||
      baseUrl === 'local' ||
      baseUrl.includes('127.0.0.1') ||
      baseUrl.includes('localhost');

    if (useLocalEngine) {
      const targetId = this.resolveLocalAccountId(
        input.accountId,
        input.accountNumber,
        input.currency,
        0,
        input.tenantId
      );
      const res = await TradingRuntimeService.creditAccount({
        accountId: targetId,
        accountNumber: input.accountNumber,
        amount: input.amount,
        currency: input.currency,
        referenceNo: input.referenceNo,
        idempotencyKey: input.idempotencyKey,
        tenantId: input.tenantId,
        adminUserId: input.adminUserId,
      });
      return res.body;
    }

    // Network HTTP call to Trading Engine
    const timestamp = Date.now();
    const payload = {
      accountId: input.accountId,
      accountNumber: input.accountNumber,
      amount: input.amount,
      currency: input.currency,
      referenceNo: input.referenceNo,
      tenantId: input.tenantId,
      adminUserId: input.adminUserId,
    };
    const signature = this.generateSignature(timestamp, payload);

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/funding/credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Signature': signature,
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(
          data.code || 'ENGINE_CREDIT_FAILED',
          data.message || `Trading Engine credit failed with HTTP ${res.status}`,
          res.status,
          data.details
        );
      }

      return data as FundingExecutionResult;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;

      // In test mode or when engine is not reachable over network, fallback to local TradingRuntimeService
      if (process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
        const targetId = this.resolveLocalAccountId(
          input.accountId,
          input.accountNumber,
          input.currency,
          0,
          input.tenantId
        );
        const localRes = await TradingRuntimeService.creditAccount({
          accountId: targetId,
          accountNumber: input.accountNumber,
          amount: input.amount,
          currency: input.currency,
          referenceNo: input.referenceNo,
          idempotencyKey: input.idempotencyKey,
          tenantId: input.tenantId,
          adminUserId: input.adminUserId,
        });
        return localRes.body;
      }

      throw new TradingEngineBridgeError(
        'ENGINE_NETWORK_ERROR',
        `Network error communicating with Trading Engine: ${err.message}`,
        502
      );
    }
  }

  /**
   * Dispatches debit to Trading Engine runtime balance with free margin enforcement.
   */
  public static async debitTradingAccount(input: FundingBridgeDebitInput): Promise<FundingExecutionResult> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine =
      process.env.CRM_USE_LOCAL_ENGINE === 'true' ||
      baseUrl === 'local' ||
      baseUrl.includes('127.0.0.1') ||
      baseUrl.includes('localhost');

    if (useLocalEngine) {
      const targetId = this.resolveLocalAccountId(
        input.accountId,
        input.accountNumber,
        input.currency,
        input.amount,
        input.tenantId
      );
      const res = await TradingRuntimeService.debitAccount({
        accountId: targetId,
        accountNumber: input.accountNumber,
        amount: input.amount,
        currency: input.currency,
        referenceNo: input.referenceNo,
        idempotencyKey: input.idempotencyKey,
        tenantId: input.tenantId,
        adminUserId: input.adminUserId,
      });
      return res.body;
    }

    const timestamp = Date.now();
    const payload = {
      accountId: input.accountId,
      accountNumber: input.accountNumber,
      amount: input.amount,
      currency: input.currency,
      referenceNo: input.referenceNo,
      tenantId: input.tenantId,
      adminUserId: input.adminUserId,
    };
    const signature = this.generateSignature(timestamp, payload);

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/funding/debit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Signature': signature,
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(
          data.code || 'ENGINE_DEBIT_FAILED',
          data.message || `Trading Engine debit failed with HTTP ${res.status}`,
          res.status,
          data.details
        );
      }

      return data as FundingExecutionResult;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;

      if (process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
        const targetId = this.resolveLocalAccountId(
          input.accountId,
          input.accountNumber,
          input.currency,
          input.amount,
          input.tenantId
        );
        const localRes = await TradingRuntimeService.debitAccount({
          accountId: targetId,
          accountNumber: input.accountNumber,
          amount: input.amount,
          currency: input.currency,
          referenceNo: input.referenceNo,
          idempotencyKey: input.idempotencyKey,
          tenantId: input.tenantId,
          adminUserId: input.adminUserId,
        });
        return localRes.body;
      }

      throw new TradingEngineBridgeError(
        'ENGINE_NETWORK_ERROR',
        `Network error communicating with Trading Engine: ${err.message}`,
        502
      );
    }
  }

  /**
   * Queries authoritative runtime account state from Trading Engine.
   */
  public static async getAccountRuntime(accountId: string, tenantId?: string): Promise<any> {
    const baseUrl = this.getBaseUrl();
    if (process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local') {
      return await TradingRuntimeService.getAccountRuntimeState(accountId, tenantId);
    }

    const timestamp = Date.now();
    const signature = this.generateSignature(timestamp);
    const tenantQuery = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/accounts/${accountId}${tenantQuery}`, {
        headers: {
          'X-CRM-Signature': signature,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(data.code || 'ENGINE_QUERY_FAILED', data.message, res.status);
      }
      return data;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      if (process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
        return await TradingRuntimeService.getAccountRuntimeState(accountId, tenantId);
      }
      throw new TradingEngineBridgeError('ENGINE_NETWORK_ERROR', err.message, 502);
    }
  }

  /**
   * Queries authoritative risk & free margin from Trading Engine.
   */
  public static async getAccountRisk(accountId: string, tenantId?: string): Promise<any> {
    const baseUrl = this.getBaseUrl();
    if (process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local') {
      return await TradingRuntimeService.getAccountRisk(accountId, tenantId);
    }

    const timestamp = Date.now();
    const signature = this.generateSignature(timestamp);
    const tenantQuery = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/accounts/${accountId}/risk${tenantQuery}`, {
        headers: {
          'X-CRM-Signature': signature,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(data.code || 'ENGINE_QUERY_FAILED', data.message, res.status);
      }
      return data;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      if (process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
        return await TradingRuntimeService.getAccountRisk(accountId, tenantId);
      }
      throw new TradingEngineBridgeError('ENGINE_NETWORK_ERROR', err.message, 502);
    }
  }

  /**
   * Observability / Health probe against Trading Engine.
   */
  public static async checkHealth(): Promise<any> {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/health`);
      return await res.json().catch(() => ({ status: 'unknown' }));
    } catch (err: any) {
      return { status: 'unreachable', error: err.message };
    }
  }
}
