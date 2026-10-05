export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'READ_ONLY';
export type InstrumentTradingStatus = 'TRADING' | 'HALTED' | 'CLOSE_ONLY';
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP';
export type OrderStatus = 'PENDING' | 'WORKING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
export type PositionStatus = 'OPEN' | 'CLOSED';

export interface TradingAccountRuntime {
  id: string;
  tenantId: string;
  accountNumber: string;
  currency: string;
  accountType: string;
  leverage: number;
  balance: number;
  equity: number;
  usedMargin: number;
  freeMargin: number;
  marginLevel: number;
  marginCallLevel: number;
  stopOutLevel: number;
  status: AccountStatus;
  tradingEnabled: boolean;
  sessionMode: 'DEMO' | 'LIVE' | 'EXTERNAL';
  platform: string;
  activeSessionCount?: number;
}

export interface OrderRuntime {
  id: string;
  clientOrderId?: string;
  accountId: string;
  tenantId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  volume: number;
  requestedPrice: number;
  executionPrice?: number;
  status: OrderStatus;
  createdAt: number;
  executedAt?: number;
  rejectReason?: string;
}

export interface PositionRuntime {
  id: string;
  accountId: string;
  tenantId: string;
  symbol: string;
  side: OrderSide;
  volume: number;
  openPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  marginLocked: number;
  openedAt: number;
  closedAt?: number;
  status: PositionStatus;
}

export interface ExecutionRuntime {
  id: string;
  orderId?: string;
  positionId: string;
  accountId: string;
  tenantId: string;
  symbol: string;
  side: OrderSide;
  type: 'OPEN' | 'CLOSE';
  volume: number;
  executionPrice: number;
  commission: number;
  fee: number;
  timestamp: number;
}

export interface InstrumentRuntime {
  symbol: string;
  name: string;
  category: 'FOREX' | 'CRYPTO' | 'COMMODITIES';
  tradingStatus: InstrumentTradingStatus;
  provider: string;
  hasLiveQuote: boolean;
  marketStatus: 'LIVE' | 'CLOSED';
  digits: number;
  tickSize: number;
  contractSize: number;
}

export interface IdempotencyRecord {
  id: string;
  idempotency_key: string;
  action: string;
  request_hash: string;
  http_status: number;
  response_payload: any;
  created_at: Date;
  expires_at: Date;
}

export interface AdminAuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  target_account_id?: string;
  target_object_id?: string;
  tenant_id: string;
  request_reference?: string;
  previous_state?: any;
  new_state?: any;
  payload_metadata?: any;
  success: boolean;
  error_code?: string;
  created_at: Date;
}

export class TradingEngineError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(code: string, message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = 'TradingEngineError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
