/**
 * TradingProvider Architecture Contract (V1 Preparation)
 * 
 * STRICT INVARIANT: ZERO LIVE EXECUTION & ZERO MOCK ENGINES.
 * This interface defines the future abstraction layer for connecting MT4, MT5, cTrader,
 * TradeLocker, and WebTrader liquidity/broker gateways.
 * 
 * In V1 CRM Request-Mode, this interface remains unimplemented. No live broker credentials
 * are called, no mock/simulated execution engines are instantiated, and no artificial
 * positions or orders are fabricated.
 */

export interface TradingAccountCredentials {
  accountId: string;
  login: string;
  server: string;
  token?: string;
}

export interface ProviderBalanceResult {
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  asOf: Date;
}

export interface ProviderPosition {
  id: string;
  accountId: string;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  sl?: number;
  tp?: number;
  swap: number;
  profit: number;
  openTime: Date;
}

export interface ProviderOrder {
  id: string;
  accountId: string;
  symbol: string;
  type: 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop';
  volume: number;
  price: number;
  sl?: number;
  tp?: number;
  status: 'pending' | 'cancelled' | 'filled';
  placedTime: Date;
}

export interface OrderSubmissionRequest {
  accountId: string;
  symbol: string;
  type: 'buy' | 'sell' | 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop';
  volume: number;
  price?: number;
  sl?: number;
  tp?: number;
  comment?: string;
}

export interface OrderSubmissionResult {
  success: boolean;
  orderId?: string;
  dealId?: string;
  errorMessage?: string;
}

export interface ClosePositionRequest {
  accountId: string;
  positionId: string;
  volume?: number;
}

export interface ClosePositionResult {
  success: boolean;
  dealId?: string;
  errorMessage?: string;
}

/**
 * Future Trading Provider Contract
 * Abstract interface defining future MT4 / MT5 / cTrader / TradeLocker bridge capabilities.
 */
export interface TradingProvider {
  readonly providerName: string;
  readonly isLiveBridge: boolean;

  /**
   * Future provider authentication method.
   * Do NOT implement real credential exchange or token flows in V1.
   */
  authenticate(credentials: TradingAccountCredentials): Promise<{ authenticated: boolean; error?: string }>;

  /**
   * Fetch account summary directly from trading platform gateway
   */
  getAccount(accountId: string): Promise<any>;

  /**
   * Fetch real-time account balance from broker bridge
   */
  getBalance(accountId: string): Promise<ProviderBalanceResult>;

  /**
   * Fetch real-time account equity from broker bridge
   */
  getEquity(accountId: string): Promise<number>;

  /**
   * Fetch live open positions from broker bridge
   */
  getOpenPositions(accountId: string): Promise<ProviderPosition[]>;

  /**
   * Fetch historical closed positions / trading history
   */
  getClosedPositions(accountId: string, from?: Date, to?: Date): Promise<ProviderPosition[]>;

  /**
   * Fetch active pending orders from broker bridge
   */
  getOrders(accountId: string): Promise<ProviderOrder[]>;

  /**
   * Future execution stub - submit new market or limit order
   */
  submitOrder(request: OrderSubmissionRequest): Promise<OrderSubmissionResult>;

  /**
   * Future execution stub - close open position
   */
  closePosition(request: ClosePositionRequest): Promise<ClosePositionResult>;
}
