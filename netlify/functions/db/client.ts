import pg from 'pg';

const { Pool } = pg;

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  role: 'client' | 'admin';
  status: 'active' | 'suspended' | 'pending';
  first_name: string;
  last_name: string;
  country: string;
  phone?: string | null;
  preferred_currency: string;
  email_verified_at?: Date | null;
  last_login_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PasswordResetRecord {
  id: string;
  email: string;
  token_hash: string;
  expires_at: Date;
  used_at?: Date | null;
  created_at: Date;
}

export interface AuditLogRecord {
  id: string;
  actor_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown> | null;
  created_at: Date;
}

export interface WalletRecord {
  id: string;
  user_id: string;
  currency: string;
  balance: string; // Stored as exact decimal string e.g. "0.00"
  reserved_balance: string; // Stored as exact decimal string e.g. "0.00"
  created_at: Date;
  updated_at: Date;
}

export interface PaymentMethodRecord {
  id: string;
  name: string;
  code: string;
  type: 'deposit' | 'withdrawal' | 'both';
  currency: string;
  min_amount: string;
  max_amount: string;
  instructions: string;
  account_details: Record<string, any>;
  is_active: boolean;
  created_at: Date;
}

export interface DepositRecord {
  id: string;
  reference_no: string;
  user_id: string;
  wallet_id: string;
  payment_method_id?: string | null;
  payment_method_name: string;
  amount: string; // Decimal string
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  proof_file_path?: string | null;
  client_notes?: string | null;
  admin_notes?: string | null;
  approved_by?: string | null;
  approved_at?: Date | null;
  rejected_by?: string | null;
  rejected_at?: Date | null;
  rejection_reason?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WithdrawalRecord {
  id: string;
  reference_no: string;
  user_id: string;
  wallet_id: string;
  payment_method_id?: string | null;
  payment_method_name: string;
  amount: string; // Decimal string
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payout_details: Record<string, any>;
  client_notes?: string | null;
  admin_notes?: string | null;
  approved_by?: string | null;
  approved_at?: Date | null;
  rejected_by?: string | null;
  rejected_at?: Date | null;
  rejection_reason?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TransactionRecord {
  id: string;
  transaction_no: string;
  user_id: string;
  wallet_id: string;
  type:
    | 'deposit'
    | 'withdrawal'
    | 'withdrawal_reserve'
    | 'withdrawal_release'
    | 'adjustment_credit'
    | 'adjustment_debit'
    | 'transfer_in'
    | 'transfer_out';
  amount: string; // Decimal string
  currency: string;
  balance_before: string;
  balance_after: string;
  reserved_before: string;
  reserved_after: string;
  status: 'completed' | 'pending' | 'failed' | 'reversed';
  reference_type?: string | null;
  reference_id?: string | null;
  description: string;
  created_at: Date;
}

export interface TradingAccountRecord {
  id: string;
  account_number: string;
  user_id: string;
  platform: 'MT4' | 'MT5' | 'cTrader' | 'WebTrader';
  account_type: 'standard' | 'raw_spread' | 'pro' | 'islamic';
  server_name: string;
  currency: string;
  leverage: string;
  status: 'pending_approval' | 'active' | 'read_only' | 'disabled' | 'archived';
  nickname?: string | null;
  is_demo: boolean;
  group_tier?: string | null;
  investor_notes?: string | null;
  admin_notes?: string | null;
  rejection_reason?: string | null;
  approved_at?: Date | null;
  approved_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface KycProfileRecord {
  id: string;
  user_id: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  first_name: string;
  last_name: string;
  date_of_birth: string; // YYYY-MM-DD
  nationality: string;
  country: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state_province?: string | null;
  postal_code: string;
  id_type: 'passport' | 'national_id' | 'drivers_license' | 'residence_permit';
  id_number: string;
  rejection_reason?: string | null;
  admin_notes?: string | null;
  submitted_at: Date;
  reviewed_at?: Date | null;
  reviewed_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface KycDocumentRecord {
  id: string;
  profile_id?: string | null;
  user_id: string;
  document_type: 'id_front' | 'id_back' | 'passport' | 'proof_of_address' | 'other';
  object_key: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SupportTicketRecord {
  id: string;
  ticket_no: string;
  user_id: string;
  subject: string;
  category: 'general' | 'deposit_withdrawal' | 'trading' | 'verification_kyc' | 'technical';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_for_client' | 'resolved' | 'closed';
  last_reply_at: Date;
  resolved_at?: Date | null;
  closed_at?: Date | null;
  assigned_to?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SupportTicketMessageRecord {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: 'client' | 'admin';
  message: string;
  is_internal: boolean;
  created_at: Date;
}

export interface SupportTicketAttachmentRecord {
  id: string;
  ticket_id: string;
  message_id?: string | null;
  user_id: string;
  object_key: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  created_at: Date;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'kyc_status' | 'deposit_status' | 'withdrawal_status' | 'trading_account' | 'support_ticket' | 'system';
  data: Record<string, any>;
  is_read: boolean;
  read_at?: Date | null;
  created_at: Date;
}

import {
  DatabaseGuard,
  DatabaseConfigurationError,
  DatabaseConnectionError,
  DatabaseSecurityError,
} from './guard';

export {
  DatabaseGuard,
  DatabaseConfigurationError,
  DatabaseConnectionError,
  DatabaseSecurityError,
};

/**
 * In-Memory Database Fallback for Development/Testing environments when DATABASE_URL is unavailable.
 * Starts in a completely clean, unseeded state. No demo or mock data is injected.
 */
class InMemoryDb {
  public users: Map<string, UserRecord> = new Map();
  public passwordResets: Map<string, PasswordResetRecord> = new Map();
  public wallets: Map<string, WalletRecord> = new Map(); // key: walletId or userId_currency
  public paymentMethods: Map<string, PaymentMethodRecord> = new Map();
  public deposits: Map<string, DepositRecord> = new Map();
  public withdrawals: Map<string, WithdrawalRecord> = new Map();
  public transactions: TransactionRecord[] = [];
  public auditLogs: AuditLogRecord[] = [];
  public tradingAccounts: Map<string, TradingAccountRecord> = new Map();
  public kycProfiles: Map<string, KycProfileRecord> = new Map(); // key: profileId or userId
  public kycDocuments: Map<string, KycDocumentRecord> = new Map();
  public supportTickets: Map<string, SupportTicketRecord> = new Map();
  public supportMessages: SupportTicketMessageRecord[] = [];
  public supportAttachments: SupportTicketAttachmentRecord[] = [];
  public notifications: NotificationRecord[] = [];

  constructor() {
    // Clean initial state: zero demo accounts, zero fake records.
  }

  public clear(): void {
    this.users.clear();
    this.passwordResets.clear();
    this.wallets.clear();
    this.paymentMethods.clear();
    this.deposits.clear();
    this.withdrawals.clear();
    this.transactions = [];
    this.auditLogs = [];
    this.tradingAccounts.clear();
    this.kycProfiles.clear();
    this.kycDocuments.clear();
    this.supportTickets.clear();
    this.supportMessages = [];
    this.supportAttachments = [];
    this.notifications = [];
  }
}

const _rawInMemoryDb = new InMemoryDb();

/**
 * Guarded In-Memory Store:
 * Any access in production immediately throws DatabaseSecurityError.
 * In-memory storage is allowed ONLY in automated tests/development helpers.
 */
export const inMemoryDb: InMemoryDb = new Proxy(_rawInMemoryDb, {
  get(target, prop, receiver) {
    DatabaseGuard.assertInMemoryAllowed();
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    DatabaseGuard.assertInMemoryAllowed();
    return Reflect.set(target, prop, value, receiver);
  },
});

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === '') {
    if (!DatabaseGuard.isTestMode()) {
      throw new DatabaseConfigurationError(
        'DATABASE_URL is not configured. PostgreSQL is strictly required in production.'
      );
    }
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const p = getPool();
  if (!p) {
    throw new DatabaseConfigurationError('DATABASE_URL is not configured. PostgreSQL connection is missing.');
  }
  try {
    const res = await p.query(text, params);
    return res.rows;
  } catch (err: any) {
    console.error('[DATABASE QUERY ERROR]', err.message);
    throw new DatabaseConnectionError(`Database query failed: ${err.message}`);
  }
}
