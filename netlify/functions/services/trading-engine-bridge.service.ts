import crypto from 'crypto';
import Decimal from 'decimal.js';
import { TradingRuntimeService } from '../../../src/trading-engine';

export interface FundingBridgeCreditInput {
  accountId: string;
  accountNumber?: string;
  amount: number;
  currency: string;
  referenceNo: string;
  idempotencyKey: string;
  transactionId?: string;
  note?: string;
  tenantId?: string;
  adminUserId?: string;
}

export interface FundingBridgeDebitInput {
  accountId: string;
  accountNumber?: string;
  amount: number;
  currency: string;
  referenceNo: string;
  idempotencyKey: string;
  transactionId?: string;
  note?: string;
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

export interface ProvisionAccountBridgeInput {
  accountId: string;
  accountNumber: string;
  currency?: string;
  leverage?: number;
  accountType?: string;
  isDemo?: boolean;
  initialBalance?: number;
  serverName?: string;
  tradingEnabled?: boolean;
  status?: string;
  tenantId?: string;
  idempotencyKey?: string;
}

export interface UpdateAccountBridgeInput {
  accountId: string;
  leverage?: number;
  status?: string;
  tradingEnabled?: boolean;
  serverName?: string;
  tenantId?: string;
  adminUserId?: string;
}

export interface ResetPasswordBridgeInput {
  accountId: string;
  accountNumber?: string;
  newPassword?: string;
  tenantId?: string;
  adminUserId?: string;
}

export interface ClosePositionBridgeInput {
  positionId: string;
  adminUserId?: string;
  reason?: string;
  tenantId?: string;
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
    const secret = process.env.CRM_M2M_SECRET || process.env.CRM_LAUNCH_SECRET;
    if (!secret || secret.trim().length < 32) {
      if (process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
        return 'test_only_crm_m2m_secret_at_least_32_characters_long_for_test!';
      }
    }
    return secret || 'test_only_crm_m2m_secret_at_least_32_characters_long_for_test!';
  }

  private static getBaseUrl(): string {
    return process.env.TRADING_ENGINE_URL || 'https://trading-platform-3a5e.onrender.com';
  }

  /**
   * Generates Base64 HMAC-SHA256 signature matching Trading Platform M2M contract:
   * Base64(HMAC-SHA256(`${timestamp}.${rawRequestBody}`, CRM_M2M_SECRET))
   */
  public static generateM2MSignature(secret: string, timestamp: string, rawRequestBody: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawRequestBody}`)
      .digest('base64');
  }

  public static generateSignature(timestamp: number | string, body?: any): string {
    const secret = this.getSecret();
    const tsStr = timestamp.toString();
    let bodyStr = '';
    if (body !== undefined && body !== null) {
      bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    }
    return this.generateM2MSignature(secret, tsStr, bodyStr);
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
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

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
    const timestamp = Date.now().toString();
    const payload = {
      accountId: input.accountId,
      amount: input.amount,
      currency: input.currency || 'USD',
      transactionId: input.transactionId || input.referenceNo,
      idempotencyKey: input.idempotencyKey || input.referenceNo,
      note: input.note || `CRM Transfer ${input.referenceNo}`,
    };
    const rawBody = JSON.stringify(payload);
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, rawBody);

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/funding/credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
          'Idempotency-Key': input.idempotencyKey || input.referenceNo,
        },
        body: rawBody,
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(
          resData.code || resData.error || 'ENGINE_CREDIT_FAILED',
          resData.message || `Trading Engine credit failed with HTTP ${res.status}`,
          res.status,
          resData.details
        );
      }

      const result = resData.data || resData;
      return {
        executionId: result.executionId || result.transactionId || result.id || input.referenceNo,
        accountId: result.accountId || input.accountId,
        previousBalance: result.previousBalance !== undefined ? Number(result.previousBalance) : 0,
        newBalance: result.newBalance !== undefined ? Number(result.newBalance) : Number(input.amount),
        executedAt: result.executedAt ? Number(result.executedAt) : Date.now(),
      };
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
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

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

    const timestamp = Date.now().toString();
    const payload = {
      accountId: input.accountId,
      amount: input.amount,
      currency: input.currency || 'USD',
      transactionId: input.transactionId || input.referenceNo,
      idempotencyKey: input.idempotencyKey || input.referenceNo,
      note: input.note || `CRM Transfer ${input.referenceNo}`,
    };
    const rawBody = JSON.stringify(payload);
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, rawBody);

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/funding/debit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
          'Idempotency-Key': input.idempotencyKey || input.referenceNo,
        },
        body: rawBody,
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(
          resData.code || resData.error || 'ENGINE_DEBIT_FAILED',
          resData.message || `Trading Engine debit failed with HTTP ${res.status}`,
          res.status,
          resData.details
        );
      }

      const result = resData.data || resData;
      return {
        executionId: result.executionId || result.transactionId || result.id || input.referenceNo,
        accountId: result.accountId || input.accountId,
        previousBalance: result.previousBalance !== undefined ? Number(result.previousBalance) : 0,
        newBalance: result.newBalance !== undefined ? Number(result.newBalance) : 0,
        executedAt: result.executedAt ? Number(result.executedAt) : Date.now(),
      };
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

    const timestamp = Date.now().toString();
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, '');
    const tenantQuery = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/accounts/${accountId}${tenantQuery}`, {
        headers: {
          'X-CRM-Timestamp': timestamp,
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

    const timestamp = Date.now().toString();
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, '');
    const tenantQuery = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/accounts/${accountId}/risk${tenantQuery}`, {
        headers: {
          'X-CRM-Timestamp': timestamp,
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
   * Dispatches trading account provisioning to Trading Platform engine.
   */
  public static async provisionTradingAccount(input: ProvisionAccountBridgeInput): Promise<{
    status: 'success' | 'error';
    accountId: string;
    accountNumber: string;
    remoteCreated?: boolean;
    error?: string;
  }> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

    if (useLocalEngine || process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      const initialBal = input.initialBalance || (input.isDemo ? 10000 : 0);
      TradingRuntimeService.upsertAccount({
        id: input.accountId,
        accountNumber: input.accountNumber,
        currency: input.currency || 'USD',
        balance: initialBal,
        equity: initialBal,
        usedMargin: 0.0,
        freeMargin: initialBal,
        marginLevel: 0.0,
        marginCallLevel: 100.0,
        stopOutLevel: 50.0,
        status: (input.status?.toUpperCase() as any) || 'ACTIVE',
        tradingEnabled: input.tradingEnabled !== undefined ? input.tradingEnabled : true,
        sessionMode: input.isDemo ? 'DEMO' : 'LIVE',
        platform: 'MT5',
        tenantId: input.tenantId || 'default',
        accountType: input.accountType || 'standard',
        leverage: input.leverage || 100,
        activeSessionCount: 0,
      });

      return {
        status: 'success',
        accountId: input.accountId,
        accountNumber: input.accountNumber,
        remoteCreated: true,
      };
    }

    const timestamp = Date.now().toString();
    const payload = {
      accountId: input.accountId,
      accountNumber: input.accountNumber,
      currency: input.currency || 'USD',
      leverage: input.leverage || 100,
      accountType: input.accountType || 'standard',
      isDemo: input.isDemo || false,
      initialBalance: input.initialBalance || 0,
      serverName: input.serverName || 'Default-Server',
      tradingEnabled: input.tradingEnabled !== false,
      status: input.status || 'ACTIVE',
      tenantId: input.tenantId || 'default',
    };
    const rawBody = JSON.stringify(payload);
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, rawBody);

    try {
      const res = await fetch(`${baseUrl}/api/admin/trading/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
          'Idempotency-Key': input.idempotencyKey || `prov-${input.accountId}`,
        },
        body: rawBody,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(
          data.code || 'PROVISIONING_FAILED',
          data.message || `Remote provisioning failed with HTTP ${res.status}`,
          res.status,
          data.details
        );
      }

      return {
        status: 'success',
        accountId: input.accountId,
        accountNumber: input.accountNumber,
        remoteCreated: true,
      };
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      throw new TradingEngineBridgeError(
        'ENGINE_NETWORK_ERROR',
        `Network error provisioning trading account on Trading Engine: ${err.message}`,
        502
      );
    }
  }

  /**
   * Updates trading account status and trading permissions on Trading Engine.
   */
  public static async updateAccountStatus(input: {
    accountId: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'READ_ONLY';
    tradingEnabled: boolean;
    reason?: string;
    tenantId?: string;
    adminUserId?: string;
  }): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

    if (useLocalEngine || process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      return await TradingRuntimeService.updateAccountStatus({
        accountId: input.accountId,
        status: input.status,
        tradingEnabled: input.tradingEnabled,
        reason: input.reason || 'Status updated via CRM',
        tenantId: input.tenantId,
        adminUserId: input.adminUserId,
      });
    }

    const timestamp = Date.now().toString();
    const rawBody = JSON.stringify(input);
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, rawBody);

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/accounts/${input.accountId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
        body: rawBody,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(data.code || 'STATUS_UPDATE_FAILED', data.message, res.status);
      }
      return data;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      throw new TradingEngineBridgeError('ENGINE_NETWORK_ERROR', err.message, 502);
    }
  }

  /**
   * Closes position on Trading Engine.
   */
  public static async closePosition(input: ClosePositionBridgeInput): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

    if (useLocalEngine || process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      return await TradingRuntimeService.closePosition({
        positionId: input.positionId,
        adminUserId: input.adminUserId,
        reason: input.reason || 'Closed by Admin via CRM',
        tenantId: input.tenantId,
      });
    }

    const timestamp = Date.now().toString();
    const rawBody = JSON.stringify(input);
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, rawBody);

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/positions/${input.positionId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
        body: rawBody,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(data.code || 'CLOSE_POSITION_FAILED', data.message, res.status);
      }
      return data;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      throw new TradingEngineBridgeError('ENGINE_NETWORK_ERROR', err.message, 502);
    }
  }

  /**
   * Closes all positions for an account on Trading Engine.
   */
  public static async closeAllPositions(input: {
    accountId: string;
    adminUserId?: string;
    reason?: string;
    tenantId?: string;
  }): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

    if (useLocalEngine || process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      return await TradingRuntimeService.closeAllPositions({
        accountId: input.accountId,
        adminUserId: input.adminUserId,
        reason: input.reason || 'Closed all positions by Admin via CRM',
        tenantId: input.tenantId,
      });
    }

    const timestamp = Date.now().toString();
    const rawBody = JSON.stringify(input);
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, rawBody);

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/accounts/${input.accountId}/close-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
        body: rawBody,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(data.code || 'CLOSE_ALL_FAILED', data.message, res.status);
      }
      return data;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      throw new TradingEngineBridgeError('ENGINE_NETWORK_ERROR', err.message, 502);
    }
  }

  /**
   * Queries open positions from Trading Engine.
   */
  public static async getPositions(accountId?: string, tenantId?: string): Promise<any[]> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

    if (useLocalEngine || process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      if (accountId) {
        return await TradingRuntimeService.getPositions(accountId, tenantId);
      }
      return Array.from((TradingRuntimeService as any).positions.values()).filter((p: any) => p.status === 'OPEN');
    }

    const timestamp = Date.now().toString();
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, '');
    const url = accountId
      ? `${baseUrl}/api/v1/admin/trading/accounts/${accountId}/positions${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`
      : `${baseUrl}/api/v1/admin/trading/positions${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`;

    try {
      const res = await fetch(url, {
        headers: {
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(data.code || 'POSITIONS_QUERY_FAILED', data.message, res.status);
      }
      return data.positions || data;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      if (process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
        if (accountId) {
          return await TradingRuntimeService.getPositions(accountId, tenantId);
        }
        return Array.from((TradingRuntimeService as any).positions.values()).filter((p: any) => p.status === 'OPEN');
      }
      throw new TradingEngineBridgeError('ENGINE_NETWORK_ERROR', err.message, 502);
    }
  }

  /**
   * Queries working orders from Trading Engine.
   */
  public static async getOrders(accountId?: string, tenantId?: string): Promise<any[]> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

    if (useLocalEngine || process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      if (accountId) {
        return await TradingRuntimeService.getOrders(accountId, tenantId);
      }
      return Array.from((TradingRuntimeService as any).orders.values());
    }

    const timestamp = Date.now().toString();
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, '');
    const url = accountId
      ? `${baseUrl}/api/v1/admin/trading/accounts/${accountId}/orders${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`
      : `${baseUrl}/api/v1/admin/trading/orders${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`;

    try {
      const res = await fetch(url, {
        headers: {
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(data.code || 'ORDERS_QUERY_FAILED', data.message, res.status);
      }
      return data.orders || data;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      if (process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
        if (accountId) {
          return await TradingRuntimeService.getOrders(accountId, tenantId);
        }
        return Array.from((TradingRuntimeService as any).orders.values());
      }
      throw new TradingEngineBridgeError('ENGINE_NETWORK_ERROR', err.message, 502);
    }
  }

  /**
   * Cancels working order on Trading Engine.
   */
  public static async cancelOrder(input: {
    orderId: string;
    adminUserId?: string;
    reason?: string;
    tenantId?: string;
  }): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

    if (useLocalEngine || process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      return await TradingRuntimeService.cancelOrder({
        orderId: input.orderId,
        adminUserId: input.adminUserId,
        reason: input.reason || 'Cancelled by Admin via CRM',
        tenantId: input.tenantId,
      });
    }

    const timestamp = Date.now().toString();
    const rawBody = JSON.stringify(input);
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, rawBody);

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/orders/${input.orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
        body: rawBody,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(data.code || 'CANCEL_ORDER_FAILED', data.message, res.status);
      }
      return data;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      throw new TradingEngineBridgeError('ENGINE_NETWORK_ERROR', err.message, 502);
    }
  }

  /**
   * Cancels all working orders for an account on Trading Engine.
   */
  public static async cancelAllOrders(input: {
    accountId: string;
    adminUserId?: string;
    reason?: string;
    tenantId?: string;
  }): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

    if (useLocalEngine || process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      return await TradingRuntimeService.cancelAllOrders({
        accountId: input.accountId,
        adminUserId: input.adminUserId,
        reason: input.reason || 'Cancelled all orders by Admin via CRM',
        tenantId: input.tenantId,
      });
    }

    const timestamp = Date.now().toString();
    const rawBody = JSON.stringify(input);
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, rawBody);

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/accounts/${input.accountId}/cancel-all-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
        body: rawBody,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(data.code || 'CANCEL_ALL_ORDERS_FAILED', data.message, res.status);
      }
      return data;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      throw new TradingEngineBridgeError('ENGINE_NETWORK_ERROR', err.message, 502);
    }
  }

  /**
   * Queries historical trade executions from Trading Engine blotter.
   */
  public static async getExecutions(filters: any = {}): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

    if (useLocalEngine || process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      return await TradingRuntimeService.getExecutions(filters);
    }

    const timestamp = Date.now().toString();
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, '');
    const queryParams = new URLSearchParams();
    if (filters.accountId) queryParams.set('accountId', filters.accountId);
    if (filters.orderId) queryParams.set('orderId', filters.orderId);
    if (filters.positionId) queryParams.set('positionId', filters.positionId);
    if (filters.symbol) queryParams.set('symbol', filters.symbol);
    if (filters.tenantId) queryParams.set('tenantId', filters.tenantId);
    if (filters.limit) queryParams.set('limit', String(filters.limit));
    if (filters.offset) queryParams.set('offset', String(filters.offset));

    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/executions${qs}`, {
        headers: {
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(data.code || 'EXECUTIONS_QUERY_FAILED', data.message, res.status);
      }
      return data;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      if (process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
        return await TradingRuntimeService.getExecutions(filters);
      }
      throw new TradingEngineBridgeError('ENGINE_NETWORK_ERROR', err.message, 502);
    }
  }

  /**
   * Queries instruments catalog and trading status from Trading Engine.
   */
  public static async getInstruments(): Promise<any[]> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

    if (useLocalEngine || process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      return await TradingRuntimeService.getInstruments();
    }

    const timestamp = Date.now().toString();
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, '');

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/instruments`, {
        headers: {
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(data.code || 'INSTRUMENTS_QUERY_FAILED', data.message, res.status);
      }
      return data.instruments || data;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      if (process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
        return await TradingRuntimeService.getInstruments();
      }
      throw new TradingEngineBridgeError('ENGINE_NETWORK_ERROR', err.message, 502);
    }
  }

  /**
   * Sets instrument trading status (TRADING, HALTED, CLOSE_ONLY) on Trading Engine.
   */
  public static async setInstrumentStatus(input: {
    symbol: string;
    status: 'TRADING' | 'HALTED' | 'CLOSE_ONLY';
    reason?: string;
    adminUserId?: string;
  }): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const useLocalEngine = process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local';

    if (useLocalEngine || process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      return await TradingRuntimeService.setInstrumentStatus({
        symbol: input.symbol.toUpperCase(),
        status: input.status,
        reason: input.reason || 'Admin status change via CRM',
        adminUserId: input.adminUserId,
      });
    }

    const timestamp = Date.now().toString();
    const rawBody = JSON.stringify(input);
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, rawBody);

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/instruments/${input.symbol.toUpperCase()}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
        body: rawBody,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new TradingEngineBridgeError(data.code || 'SET_INSTRUMENT_STATUS_FAILED', data.message, res.status);
      }
      return data;
    } catch (err: any) {
      if (err instanceof TradingEngineBridgeError) throw err;
      throw new TradingEngineBridgeError('ENGINE_NETWORK_ERROR', err.message, 502);
    }
  }

  /**
   * Reconciles in-flight or ambiguous transfer state with Trading Engine.
   */
  public static async reconcileFundingTransfer(referenceNo: string, tenantId?: string): Promise<{
    found: boolean;
    status?: string;
    executionId?: string;
  }> {
    const baseUrl = this.getBaseUrl();
    if (process.env.CRM_USE_LOCAL_ENGINE === 'true' || baseUrl === 'local' || process.env.NODE_ENV === 'test' || process.env.CRM_TEST_MODE === 'true') {
      return { found: true, status: 'confirmed', executionId: `rec-${referenceNo}` };
    }

    const timestamp = Date.now().toString();
    const signature = this.generateM2MSignature(this.getSecret(), timestamp, '');
    const tenantQuery = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';

    try {
      const res = await fetch(`${baseUrl}/api/v1/admin/trading/funding/reconcile/${encodeURIComponent(referenceNo)}${tenantQuery}`, {
        headers: {
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
      });
      if (res.status === 404) {
        return { found: false };
      }
      const data = await res.json().catch(() => ({}));
      return {
        found: true,
        status: data.status || 'confirmed',
        executionId: data.executionId || data.transactionId,
      };
    } catch {
      return { found: false };
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
