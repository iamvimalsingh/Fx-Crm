/**
 * TradingProvider Architecture Contract (Frontend Type Definitions)
 * 
 * STRICT INVARIANT: ZERO LIVE EXECUTION & ZERO MOCK ENGINES.
 * Abstract interface defining future MT4 / MT5 / cTrader / TradeLocker bridge capabilities.
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

export interface TradingProvider {
  readonly providerName: string;
  readonly isLiveBridge: boolean;

  /** Future provider authentication - do not implement real credential exchange or token flows */
  authenticate(credentials: TradingAccountCredentials): Promise<{ authenticated: boolean; error?: string }>;

  /** Fetch broker account details */
  getAccount(accountId: string): Promise<any>;

  /** Real-time balance retrieval */
  getBalance(accountId: string): Promise<ProviderBalanceResult>;

  /** Real-time equity retrieval */
  getEquity(accountId: string): Promise<number>;

  /** Fetch current open positions */
  getOpenPositions(accountId: string): Promise<ProviderPosition[]>;

  /** Fetch historical closed positions */
  getClosedPositions(accountId: string, from?: Date, to?: Date): Promise<ProviderPosition[]>;

  /** Fetch active pending orders */
  getOrders(accountId: string): Promise<ProviderOrder[]>;

  /** Future execution stub */
  submitOrder(request: OrderSubmissionRequest): Promise<OrderSubmissionResult>;

  /** Future execution stub */
  closePosition(request: ClosePositionRequest): Promise<ClosePositionResult>;
}
