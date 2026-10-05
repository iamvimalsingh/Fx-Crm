import Decimal from 'decimal.js';
import crypto from 'crypto';
import {
  TradingAccountRuntime,
  OrderRuntime,
  PositionRuntime,
  ExecutionRuntime,
  InstrumentRuntime,
  TradingEngineError,
} from '../types';
import { AuditService } from './audit.service';
import { IdempotencyService } from './idempotency.service';

export class TradingRuntimeService {
  private static accounts = new Map<string, TradingAccountRuntime>();
  private static orders = new Map<string, OrderRuntime>();
  private static positions = new Map<string, PositionRuntime>();
  private static executions: ExecutionRuntime[] = [];
  private static instruments = new Map<string, InstrumentRuntime>();
  private static activeSessions = new Map<string, Set<string>>(); // accountId -> Set<sessionId>

  static {
    this.seedDefaultState();
  }

  public static seedDefaultState() {
    this.accounts.clear();
    this.orders.clear();
    this.positions.clear();
    this.executions = [];
    this.instruments.clear();
    this.activeSessions.clear();

    // Default accounts matching live engine state
    const demo1001: TradingAccountRuntime = {
      id: 'acc_demo_1001',
      tenantId: 'tenant_default',
      accountNumber: 'DEMO-1001',
      currency: 'USD',
      accountType: 'DEMO',
      leverage: 100,
      balance: 10000.0,
      equity: 10000.0,
      usedMargin: 0.0,
      freeMargin: 10000.0,
      marginLevel: 0.0,
      marginCallLevel: 100.0,
      stopOutLevel: 50.0,
      status: 'ACTIVE',
      tradingEnabled: true,
      sessionMode: 'DEMO',
      platform: 'PROPRIETARY',
      activeSessionCount: 0,
    };

    const live57775: TradingAccountRuntime = {
      id: 'acc_uuid_57775_live',
      tenantId: 'default',
      accountNumber: '57775',
      currency: 'USD',
      accountType: 'standard',
      leverage: 500,
      balance: 50000.0,
      equity: 50000.0,
      usedMargin: 0.0,
      freeMargin: 50000.0,
      marginLevel: 0.0,
      marginCallLevel: 100.0,
      stopOutLevel: 50.0,
      status: 'ACTIVE',
      tradingEnabled: true,
      sessionMode: 'LIVE',
      platform: 'MT5',
      activeSessionCount: 0,
    };

    this.accounts.set(demo1001.id, demo1001);
    this.accounts.set(demo1001.accountNumber, demo1001);
    this.accounts.set(live57775.id, live57775);
    this.accounts.set(live57775.accountNumber, live57775);

    // Seed 18 symbols identified in audit
    const symbolsList: Array<[string, string, 'FOREX' | 'CRYPTO' | 'COMMODITIES', number, number, number]> = [
      ['EURUSD', 'Euro / US Dollar', 'FOREX', 5, 0.00001, 100000],
      ['GBPUSD', 'British Pound / US Dollar', 'FOREX', 5, 0.00001, 100000],
      ['USDJPY', 'US Dollar / Japanese Yen', 'FOREX', 3, 0.001, 100000],
      ['USDCHF', 'US Dollar / Swiss Franc', 'FOREX', 5, 0.00001, 100000],
      ['AUDUSD', 'Australian Dollar / USD', 'FOREX', 5, 0.00001, 100000],
      ['USDCAD', 'US Dollar / Canadian Dollar', 'FOREX', 5, 0.00001, 100000],
      ['NZDUSD', 'New Zealand Dollar / US Dollar', 'FOREX', 5, 0.00001, 100000],
      ['USDCNH', 'US Dollar / Chinese Yuan', 'FOREX', 5, 0.00001, 100000],
      ['EURJPY', 'Euro / Japanese Yen', 'FOREX', 3, 0.001, 100000],
      ['GBPJPY', 'British Pound / Japanese Yen', 'FOREX', 3, 0.001, 100000],
      ['BTCUSD', 'Bitcoin / US Dollar', 'CRYPTO', 2, 0.01, 1],
      ['ETHUSD', 'Ethereum / US Dollar', 'CRYPTO', 2, 0.01, 1],
      ['BNBUSD', 'Binance Coin / US Dollar', 'CRYPTO', 2, 0.01, 1],
      ['SOLUSD', 'Solana / US Dollar', 'CRYPTO', 2, 0.01, 1],
      ['XRPUSD', 'Ripple / US Dollar', 'CRYPTO', 4, 0.0001, 1],
      ['XAUUSD', 'Gold / USD', 'COMMODITIES', 2, 0.01, 100],
      ['XAGUSD', 'Silver / USD', 'COMMODITIES', 3, 0.001, 5000],
      ['WTIUSD', 'WTI Crude Oil / USD', 'COMMODITIES', 2, 0.01, 1000],
    ];

    for (const [sym, name, cat, digits, tick, contract] of symbolsList) {
      this.instruments.set(sym, {
        symbol: sym,
        name,
        category: cat,
        tradingStatus: 'TRADING',
        provider: cat === 'FOREX' ? 'tiingo_fx' : 'twelve_data',
        hasLiveQuote: true,
        marketStatus: 'LIVE',
        digits,
        tickSize: tick,
        contractSize: contract,
      });
    }
  }

  // --- ACCOUNTS & RISK ---
  public static getAccount(accountIdOrNumber: string): TradingAccountRuntime | undefined {
    return this.accounts.get(accountIdOrNumber);
  }

  public static upsertAccount(account: TradingAccountRuntime) {
    this.accounts.set(account.id, account);
    this.accounts.set(account.accountNumber, account);
  }

  public static recalculateRisk(account: TradingAccountRuntime) {
    const accPositions = Array.from(this.positions.values()).filter(
      (p) => p.accountId === account.id && p.status === 'OPEN'
    );

    let totalUsedMargin = new Decimal(0);
    let totalUnrealizedPnL = new Decimal(0);

    for (const pos of accPositions) {
      totalUsedMargin = totalUsedMargin.plus(pos.marginLocked);
      totalUnrealizedPnL = totalUnrealizedPnL.plus(pos.unrealizedPnL);
    }

    const balanceDec = new Decimal(account.balance);
    const equityDec = balanceDec.plus(totalUnrealizedPnL);
    const freeMarginDec = Decimal.max(0, equityDec.minus(totalUsedMargin));

    account.usedMargin = Number(totalUsedMargin.toFixed(2));
    account.equity = Number(equityDec.toFixed(2));
    account.freeMargin = Number(freeMarginDec.toFixed(2));

    if (totalUsedMargin.gt(0)) {
      account.marginLevel = Number(equityDec.dividedBy(totalUsedMargin).times(100).toFixed(2));
    } else {
      account.marginLevel = 0;
    }
  }

  public static async getAccountRuntimeState(accountId: string, tenantId?: string) {
    const account = this.getAccount(accountId);
    if (!account) {
      throw new TradingEngineError('ACCOUNT_NOT_FOUND', `Trading account ${accountId} not found`, 404);
    }
    if (tenantId && account.tenantId !== tenantId) {
      throw new TradingEngineError('TENANT_ACCESS_DENIED', `Cross-tenant access denied`, 403);
    }

    this.recalculateRisk(account);

    const openPositions = Array.from(this.positions.values()).filter(
      (p) => p.accountId === account.id && p.status === 'OPEN'
    );

    return {
      accountId: account.id,
      accountNumber: account.accountNumber,
      tenantId: account.tenantId,
      currency: account.currency,
      balance: account.balance,
      equity: account.equity,
      usedMargin: account.usedMargin,
      freeMargin: account.freeMargin,
      marginLevel: account.marginLevel,
      status: account.status,
      tradingEnabled: account.tradingEnabled,
      openPositionsCount: openPositions.length,
    };
  }

  public static async getAccountRisk(accountId: string, tenantId?: string) {
    const account = this.getAccount(accountId);
    if (!account) {
      throw new TradingEngineError('ACCOUNT_NOT_FOUND', `Trading account ${accountId} not found`, 404);
    }
    if (tenantId && account.tenantId !== tenantId) {
      throw new TradingEngineError('TENANT_ACCESS_DENIED', `Cross-tenant access denied`, 403);
    }

    this.recalculateRisk(account);

    const canWithdrawAmount = Math.max(0, Math.min(account.freeMargin, account.balance));

    return {
      accountId: account.id,
      balance: account.balance,
      equity: account.equity,
      usedMargin: account.usedMargin,
      freeMargin: account.freeMargin,
      marginLevel: account.marginLevel,
      marginCallLevel: account.marginCallLevel,
      stopOutLevel: account.stopOutLevel,
      canWithdrawAmount: Number(new Decimal(canWithdrawAmount).toFixed(2)),
    };
  }

  // --- FUNDING CREDIT & DEBIT ---
  public static async creditAccount(params: {
    accountId: string;
    accountNumber: string;
    amount: number;
    currency: string;
    referenceNo: string;
    idempotencyKey: string;
    tenantId?: string;
    adminUserId?: string;
  }) {
    return await IdempotencyService.executeIdempotent(
      params.idempotencyKey,
      'funding_credit',
      params,
      async () => {
        const account = this.getAccount(params.accountId);
        if (!account) {
          throw new TradingEngineError('ACCOUNT_NOT_FOUND', `Account ${params.accountId} not found`, 404);
        }
        if (params.tenantId && account.tenantId !== params.tenantId) {
          throw new TradingEngineError('TENANT_ACCESS_DENIED', 'Cross-tenant access denied', 403);
        }
        if (account.currency !== params.currency) {
          throw new TradingEngineError('INVALID_CURRENCY', `Currency mismatch: account is ${account.currency}`, 400);
        }
        if (typeof params.amount !== 'number' || isNaN(params.amount) || params.amount <= 0) {
          throw new TradingEngineError('INVALID_AMOUNT', 'Amount must be a positive decimal number', 400);
        }

        const prevBalance = account.balance;
        const newBalance = Number(new Decimal(prevBalance).plus(params.amount).toFixed(2));

        account.balance = newBalance;
        this.recalculateRisk(account);

        const executionId = `exec_c_${crypto.randomUUID().slice(0, 8)}`;
        const executedAt = Date.now();

        await AuditService.log({
          adminUserId: params.adminUserId || 'crm_system_m2m',
          action: 'FUNDING_CREDIT',
          targetAccountId: account.id,
          targetObjectId: executionId,
          tenantId: account.tenantId,
          requestReference: params.referenceNo,
          previousState: { balance: prevBalance },
          newState: { balance: newBalance },
          payloadMetadata: { amount: params.amount, currency: params.currency },
          success: true,
        });

        return {
          status: 200,
          body: {
            status: 'success',
            executionId,
            accountId: account.id,
            previousBalance: prevBalance,
            newBalance,
            executedAt,
          },
        };
      }
    );
  }

  public static async debitAccount(params: {
    accountId: string;
    accountNumber: string;
    amount: number;
    currency: string;
    referenceNo: string;
    idempotencyKey: string;
    tenantId?: string;
    adminUserId?: string;
  }) {
    return await IdempotencyService.executeIdempotent(
      params.idempotencyKey,
      'funding_debit',
      params,
      async () => {
        const account = this.getAccount(params.accountId);
        if (!account) {
          throw new TradingEngineError('ACCOUNT_NOT_FOUND', `Account ${params.accountId} not found`, 404);
        }
        if (params.tenantId && account.tenantId !== params.tenantId) {
          throw new TradingEngineError('TENANT_ACCESS_DENIED', 'Cross-tenant access denied', 403);
        }
        if (account.currency !== params.currency) {
          throw new TradingEngineError('INVALID_CURRENCY', `Currency mismatch: account is ${account.currency}`, 400);
        }
        if (typeof params.amount !== 'number' || isNaN(params.amount) || params.amount <= 0) {
          throw new TradingEngineError('INVALID_AMOUNT', 'Amount must be a positive decimal number', 400);
        }

        this.recalculateRisk(account);

        const maxWithdrawable = Math.max(0, Math.min(account.freeMargin, account.balance));
        if (params.amount > maxWithdrawable) {
          throw new TradingEngineError(
            'INSUFFICIENT_FREE_MARGIN',
            `Requested amount ${params.amount} exceeds available withdrawable free margin ${maxWithdrawable}`,
            400,
            { freeMargin: account.freeMargin, balance: account.balance, requestedAmount: params.amount }
          );
        }

        const prevBalance = account.balance;
        const newBalance = Number(new Decimal(prevBalance).minus(params.amount).toFixed(2));
        if (newBalance < 0) {
          throw new TradingEngineError('INVALID_AMOUNT', 'Debit operation would result in negative balance', 400);
        }

        account.balance = newBalance;
        this.recalculateRisk(account);

        const executionId = `exec_d_${crypto.randomUUID().slice(0, 8)}`;
        const executedAt = Date.now();

        await AuditService.log({
          adminUserId: params.adminUserId || 'crm_system_m2m',
          action: 'FUNDING_DEBIT',
          targetAccountId: account.id,
          targetObjectId: executionId,
          tenantId: account.tenantId,
          requestReference: params.referenceNo,
          previousState: { balance: prevBalance },
          newState: { balance: newBalance },
          payloadMetadata: { amount: params.amount, currency: params.currency },
          success: true,
        });

        return {
          status: 200,
          body: {
            status: 'success',
            executionId,
            accountId: account.id,
            previousBalance: prevBalance,
            newBalance,
            executedAt,
          },
        };
      }
    );
  }

  // --- ACCOUNT OPERATIONAL STATUS ---
  public static async updateAccountStatus(params: {
    accountId: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'READ_ONLY';
    tradingEnabled: boolean;
    reason: string;
    tenantId?: string;
    adminUserId?: string;
  }) {
    const account = this.getAccount(params.accountId);
    if (!account) {
      throw new TradingEngineError('ACCOUNT_NOT_FOUND', `Account ${params.accountId} not found`, 404);
    }
    if (params.tenantId && account.tenantId !== params.tenantId) {
      throw new TradingEngineError('TENANT_ACCESS_DENIED', 'Cross-tenant access denied', 403);
    }

    const prevStatus = { status: account.status, tradingEnabled: account.tradingEnabled };

    account.status = params.status;
    account.tradingEnabled = params.tradingEnabled;

    // If disabled or suspended, revoke active WebSocket sessions
    let sessionsRevoked = 0;
    if (params.status === 'SUSPENDED' || !params.tradingEnabled) {
      const sessions = this.activeSessions.get(account.id);
      if (sessions) {
        sessionsRevoked = sessions.size;
        sessions.clear();
      }
    }

    await AuditService.log({
      adminUserId: params.adminUserId || 'crm_system_m2m',
      action: 'UPDATE_ACCOUNT_STATUS',
      targetAccountId: account.id,
      tenantId: account.tenantId,
      previousState: prevStatus,
      newState: { status: account.status, tradingEnabled: account.tradingEnabled, reason: params.reason },
      payloadMetadata: { sessionsRevoked },
      success: true,
    });

    return {
      status: 'success',
      accountId: account.id,
      accountStatus: account.status,
      tradingEnabled: account.tradingEnabled,
      sessionsRevoked,
      updatedAt: Date.now(),
    };
  }

  // --- POSITIONS ---
  public static addPosition(position: PositionRuntime) {
    this.positions.set(position.id, position);
    const account = this.getAccount(position.accountId);
    if (account) this.recalculateRisk(account);
  }

  public static async getPositions(accountId: string, tenantId?: string): Promise<PositionRuntime[]> {
    const account = this.getAccount(accountId);
    if (!account) {
      throw new TradingEngineError('ACCOUNT_NOT_FOUND', `Account ${accountId} not found`, 404);
    }
    if (tenantId && account.tenantId !== tenantId) {
      throw new TradingEngineError('TENANT_ACCESS_DENIED', 'Cross-tenant access denied', 403);
    }

    return Array.from(this.positions.values()).filter(
      (p) => p.accountId === account.id && p.status === 'OPEN'
    );
  }

  public static async closePosition(params: {
    positionId: string;
    adminUserId?: string;
    reason?: string;
    tenantId?: string;
  }) {
    const position = this.positions.get(params.positionId);
    if (!position) {
      throw new TradingEngineError('POSITION_NOT_FOUND', `Position ${params.positionId} not found`, 404);
    }
    if (position.status === 'CLOSED') {
      throw new TradingEngineError('POSITION_ALREADY_CLOSED', `Position ${params.positionId} is already closed`, 400);
    }
    const account = this.getAccount(position.accountId);
    if (!account) {
      throw new TradingEngineError('ACCOUNT_NOT_FOUND', `Account ${position.accountId} not found`, 404);
    }
    if (params.tenantId && account.tenantId !== params.tenantId) {
      throw new TradingEngineError('TENANT_ACCESS_DENIED', 'Cross-tenant access denied', 403);
    }

    // Authoritative close at current price
    const closePrice = position.currentPrice;
    const realizedPnL = position.unrealizedPnL;
    position.status = 'CLOSED';
    position.closedAt = Date.now();
    position.realizedPnL = realizedPnL;
    position.unrealizedPnL = 0;
    position.marginLocked = 0;

    // Update account balance and risk
    account.balance = Number(new Decimal(account.balance).plus(realizedPnL).toFixed(2));
    this.recalculateRisk(account);

    const execution: ExecutionRuntime = {
      id: `exec_cls_${crypto.randomUUID().slice(0, 8)}`,
      positionId: position.id,
      accountId: account.id,
      tenantId: account.tenantId,
      symbol: position.symbol,
      side: position.side === 'BUY' ? 'SELL' : 'BUY',
      type: 'CLOSE',
      volume: position.volume,
      executionPrice: closePrice,
      commission: 0,
      fee: 0,
      timestamp: Date.now(),
    };
    this.executions.push(execution);

    await AuditService.log({
      adminUserId: params.adminUserId || 'crm_system_m2m',
      action: 'CLOSE_POSITION',
      targetAccountId: account.id,
      targetObjectId: position.id,
      tenantId: account.tenantId,
      previousState: { status: 'OPEN', marginLocked: position.marginLocked },
      newState: { status: 'CLOSED', realizedPnL, closePrice },
      payloadMetadata: { reason: params.reason },
      success: true,
    });

    return {
      status: 'success',
      position,
      execution,
    };
  }

  public static async closeAllPositions(params: {
    accountId: string;
    adminUserId?: string;
    reason?: string;
    tenantId?: string;
  }) {
    const account = this.getAccount(params.accountId);
    if (!account) {
      throw new TradingEngineError('ACCOUNT_NOT_FOUND', `Account ${params.accountId} not found`, 404);
    }
    if (params.tenantId && account.tenantId !== params.tenantId) {
      throw new TradingEngineError('TENANT_ACCESS_DENIED', 'Cross-tenant access denied', 403);
    }

    const openPositions = Array.from(this.positions.values()).filter(
      (p) => p.accountId === account.id && p.status === 'OPEN'
    );

    const executions: ExecutionRuntime[] = [];
    let totalRealizedPnL = new Decimal(0);

    for (const pos of openPositions) {
      pos.status = 'CLOSED';
      pos.closedAt = Date.now();
      pos.realizedPnL = pos.unrealizedPnL;
      totalRealizedPnL = totalRealizedPnL.plus(pos.realizedPnL);
      pos.unrealizedPnL = 0;
      pos.marginLocked = 0;

      const exec: ExecutionRuntime = {
        id: `exec_cls_${crypto.randomUUID().slice(0, 8)}`,
        positionId: pos.id,
        accountId: account.id,
        tenantId: account.tenantId,
        symbol: pos.symbol,
        side: pos.side === 'BUY' ? 'SELL' : 'BUY',
        type: 'CLOSE',
        volume: pos.volume,
        executionPrice: pos.currentPrice,
        commission: 0,
        fee: 0,
        timestamp: Date.now(),
      };
      this.executions.push(exec);
      executions.push(exec);
    }

    account.balance = Number(new Decimal(account.balance).plus(totalRealizedPnL).toFixed(2));
    this.recalculateRisk(account);

    await AuditService.log({
      adminUserId: params.adminUserId || 'crm_system_m2m',
      action: 'CLOSE_ALL_POSITIONS',
      targetAccountId: account.id,
      tenantId: account.tenantId,
      newState: { closedCount: openPositions.length, totalRealizedPnL: Number(totalRealizedPnL.toFixed(2)) },
      payloadMetadata: { reason: params.reason },
      success: true,
    });

    return {
      status: 'success',
      closedPositionsCount: openPositions.length,
      totalRealizedPnL: Number(totalRealizedPnL.toFixed(2)),
      executions,
    };
  }

  // --- ORDERS ---
  public static addOrder(order: OrderRuntime) {
    this.orders.set(order.id, order);
  }

  public static async getOrders(accountId: string, tenantId?: string): Promise<OrderRuntime[]> {
    const account = this.getAccount(accountId);
    if (!account) {
      throw new TradingEngineError('ACCOUNT_NOT_FOUND', `Account ${accountId} not found`, 404);
    }
    if (tenantId && account.tenantId !== tenantId) {
      throw new TradingEngineError('TENANT_ACCESS_DENIED', 'Cross-tenant access denied', 403);
    }

    return Array.from(this.orders.values()).filter((o) => o.accountId === account.id);
  }

  public static async cancelOrder(params: {
    orderId: string;
    adminUserId?: string;
    reason?: string;
    tenantId?: string;
  }) {
    const order = this.orders.get(params.orderId);
    if (!order) {
      throw new TradingEngineError('ORDER_NOT_FOUND', `Order ${params.orderId} not found`, 404);
    }
    if (order.status === 'CANCELLED') {
      throw new TradingEngineError('ORDER_ALREADY_CANCELLED', `Order ${params.orderId} is already cancelled`, 400);
    }
    if (order.status === 'FILLED' || order.status === 'REJECTED') {
      throw new TradingEngineError('ORDER_NOT_FOUND', `Order cannot be cancelled in state ${order.status}`, 400);
    }

    order.status = 'CANCELLED';

    await AuditService.log({
      adminUserId: params.adminUserId || 'crm_system_m2m',
      action: 'CANCEL_ORDER',
      targetAccountId: order.accountId,
      targetObjectId: order.id,
      tenantId: order.tenantId,
      previousState: { status: 'PENDING' },
      newState: { status: 'CANCELLED' },
      payloadMetadata: { reason: params.reason },
      success: true,
    });

    return {
      status: 'success',
      order,
    };
  }

  public static async cancelAllOrders(params: {
    accountId: string;
    adminUserId?: string;
    reason?: string;
    tenantId?: string;
  }) {
    const account = this.getAccount(params.accountId);
    if (!account) {
      throw new TradingEngineError('ACCOUNT_NOT_FOUND', `Account ${params.accountId} not found`, 404);
    }
    if (params.tenantId && account.tenantId !== params.tenantId) {
      throw new TradingEngineError('TENANT_ACCESS_DENIED', 'Cross-tenant access denied', 403);
    }

    const workingOrders = Array.from(this.orders.values()).filter(
      (o) => o.accountId === account.id && (o.status === 'PENDING' || o.status === 'WORKING')
    );

    for (const o of workingOrders) {
      o.status = 'CANCELLED';
    }

    await AuditService.log({
      adminUserId: params.adminUserId || 'crm_system_m2m',
      action: 'CANCEL_ALL_ORDERS',
      targetAccountId: account.id,
      tenantId: account.tenantId,
      newState: { cancelledCount: workingOrders.length },
      payloadMetadata: { reason: params.reason },
      success: true,
    });

    return {
      status: 'success',
      cancelledOrdersCount: workingOrders.length,
      orders: workingOrders,
    };
  }

  // --- EXECUTIONS QUERY ---
  public static async getExecutions(filters: {
    accountId?: string;
    orderId?: string;
    positionId?: string;
    symbol?: string;
    tenantId?: string;
    startDate?: number;
    endDate?: number;
    limit?: number;
    offset?: number;
  }) {
    let result = [...this.executions];

    if (filters.accountId) {
      result = result.filter((e) => e.accountId === filters.accountId);
    }
    if (filters.orderId) {
      result = result.filter((e) => e.orderId === filters.orderId);
    }
    if (filters.positionId) {
      result = result.filter((e) => e.positionId === filters.positionId);
    }
    if (filters.symbol) {
      result = result.filter((e) => e.symbol === filters.symbol);
    }
    if (filters.tenantId) {
      result = result.filter((e) => e.tenantId === filters.tenantId);
    }
    if (filters.startDate) {
      result = result.filter((e) => e.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      result = result.filter((e) => e.timestamp <= filters.endDate!);
    }

    // Sort descending by timestamp
    result.sort((a, b) => b.timestamp - a.timestamp);

    const total = result.length;
    const offset = Math.max(0, filters.offset || 0);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const paginated = result.slice(offset, offset + limit);

    return {
      executions: paginated,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
    };
  }

  // --- INSTRUMENT CONTROLS ---
  public static async getInstruments(): Promise<InstrumentRuntime[]> {
    return Array.from(this.instruments.values());
  }

  public static async setInstrumentStatus(params: {
    symbol: string;
    status: 'TRADING' | 'HALTED' | 'CLOSE_ONLY';
    reason: string;
    adminUserId?: string;
  }) {
    const instrument = this.instruments.get(params.symbol);
    if (!instrument) {
      throw new TradingEngineError('SYMBOL_NOT_FOUND', `Symbol ${params.symbol} not found in engine catalog`, 404);
    }

    const prevStatus = instrument.tradingStatus;
    instrument.tradingStatus = params.status;

    await AuditService.log({
      adminUserId: params.adminUserId || 'crm_system_m2m',
      action: 'UPDATE_INSTRUMENT_STATUS',
      targetObjectId: instrument.symbol,
      tenantId: 'global',
      previousState: { tradingStatus: prevStatus },
      newState: { tradingStatus: instrument.tradingStatus, reason: params.reason },
      success: true,
    });

    return {
      status: 'success',
      symbol: instrument.symbol,
      tradingStatus: instrument.tradingStatus,
      updatedAt: Date.now(),
    };
  }
}
