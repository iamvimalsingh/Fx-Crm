import crypto from 'crypto';
import {
  getPool,
  query,
  inMemoryDb,
  TradingAccountRecord,
  UserRecord,
  AuditLogRecord,
  TradingPasswordResetRecord,
} from '../db/client';
import { NotificationService } from './notification.service';
import {
  RegisterTradingAccountInput,
  LinkTradingAccountInput,
  ApproveTradingAccountInput,
  RejectTradingAccountInput,
  AdminUpdateTradingAccountMetadataInput,
} from '../middleware/validation';

export * from './trading-provider.contract';

export interface TradingAccountWithOwner extends TradingAccountRecord {
  owner?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    country: string;
  };
}

export class TradingAccountService {
  /**
   * Records an audit log entry for trading account events
   */
  public static async recordAuditLog(
    actorId: string | null,
    action: string,
    targetId: string,
    details: Record<string, any>,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const pool = getPool();
    const now = new Date();
    const auditId = crypto.randomUUID();
    const sanitizedIp = ip ? String(ip).split(',')[0].trim().substring(0, 100) : null;
    const sanitizedUserAgent = userAgent ? String(userAgent).substring(0, 500) : null;

    if (pool) {
      await query(
        `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [auditId, actorId, action, 'trading_account', targetId, JSON.stringify(details), sanitizedIp, sanitizedUserAgent, now]
      );
    } else {
      const record: AuditLogRecord = {
        id: auditId,
        actor_id: actorId,
        action,
        entity_type: 'trading_account',
        entity_id: targetId,
        details,
        ip_address: sanitizedIp,
        user_agent: sanitizedUserAgent,
        created_at: now,
      };
      inMemoryDb.auditLogs.unshift(record);
    }
  }

  /**
   * Generates a numeric account login number
   */
  private static generateAccountNumber(isDemo: boolean): string {
    const prefix = isDemo ? '90' : '20';
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${rand}`;
  }

  /**
   * Platform-agnostic terminal URL resolver based on platform and environment config
   */
  public static resolveDefaultTerminalUrl(platform: string): string | null {
    const cleanPlatform = (platform || '').trim().toUpperCase();
    const envKey = `TERMINAL_URL_${cleanPlatform}`;
    if (process.env[envKey]) {
      return process.env[envKey]!;
    }
    if (process.env.DEFAULT_TERMINAL_URL) {
      return process.env.DEFAULT_TERMINAL_URL;
    }
    switch (cleanPlatform) {
      case 'MT5':
      case 'MT4':
        return 'https://trade.mql5.com/trade';
      case 'CTRADER':
        return 'https://ct.spotware.com';
      case 'EDGETRADER':
      case 'AEROTRADER':
      case 'WEBTRADER':
        return null;
      default:
        return null;
    }
  }

  /**
   * Safely decodes and hydrates a raw DB row or in-memory record into a full TradingAccountRecord
   */
  public static hydrateAccountRecord(row: any): TradingAccountRecord {
    let demoPassword = row.password || null;
    let demoBalance =
      row.balance !== undefined && row.balance !== null
        ? String(row.balance)
        : row.is_demo
        ? '10000.00'
        : '0.00';
    let terminalUrl = row.terminal_url || null;
    let cleanInvestorNotes = row.investor_notes || null;

    if (row.investor_notes && typeof row.investor_notes === 'string' && row.investor_notes.startsWith('{')) {
      try {
        const meta = JSON.parse(row.investor_notes);
        if (meta.password !== undefined) demoPassword = meta.password;
        if (meta.balance !== undefined) demoBalance = meta.balance;
        if (meta.terminal_url !== undefined) terminalUrl = meta.terminal_url;
        if (meta.notes !== undefined) cleanInvestorNotes = meta.notes;
      } catch {
        // Leave unparsed if not JSON
      }
    }

    if (row.is_demo) {
      if (!demoBalance || demoBalance === '0' || demoBalance === '0.00') {
        demoBalance = '10000.00';
      }
      if (!demoPassword) {
        demoPassword = 'Demo@' + (row.account_number ? String(row.account_number).slice(-4) : Math.floor(1000 + Math.random() * 9000));
      }
      if (!terminalUrl) {
        terminalUrl = this.resolveDefaultTerminalUrl(row.platform);
      }
    }

    return {
      id: row.id,
      account_number: String(row.account_number),
      user_id: row.user_id,
      platform: row.platform,
      account_type: row.account_type,
      server_name: row.server_name,
      currency: row.currency,
      leverage: row.leverage,
      status: row.status,
      nickname: row.nickname || null,
      is_demo: Boolean(row.is_demo),
      group_tier: row.group_tier || null,
      investor_notes: cleanInvestorNotes,
      admin_notes: row.admin_notes || null,
      rejection_reason: row.rejection_reason || null,
      approved_at: row.approved_at ? new Date(row.approved_at) : null,
      approved_by: row.approved_by || null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      password: demoPassword,
      balance: demoBalance,
      terminal_url: terminalUrl,
    };
  }

  /**
   * Parses auxiliary fields from a record's investor_notes or raw JSON
   */
  private static parseMetadata(record: any): Record<string, any> {
    if (!record) return {};
    const notes = typeof record === 'string' ? record : record.investor_notes;
    if (notes && typeof notes === 'string' && notes.startsWith('{')) {
      try {
        return JSON.parse(notes);
      } catch {
        return { notes };
      }
    }
    return { notes: notes || null };
  }

  /**
   * Serializes auxiliary fields into a JSON string to ensure compatibility with all database engines
   */
  private static serializeMetadata(record: any): string {
    if (!record) return JSON.stringify({});
    return JSON.stringify({
      password: record.password ?? record.demo_password ?? null,
      balance: record.balance ?? null,
      terminal_url: record.terminal_url ?? null,
      notes: record.notes ?? record.investor_notes ?? null,
      ...record,
    });
  }

  /**
   * Provision default demo trading account for a new or existing client
   */
  public static async provisionDefaultDemoAccount(
    userId: string,
    preferredCurrency: string = 'USD',
    ip?: string,
    userAgent?: string
  ): Promise<TradingAccountRecord> {
    const now = new Date();
    const accountId = crypto.randomUUID();
    const accountNumber = this.generateAccountNumber(true);
    const defaultPlatform = process.env.DEFAULT_TRADING_PLATFORM || 'MT5';
    const defaultServer = process.env.DEFAULT_DEMO_SERVER || `${defaultPlatform}-Demo-Server`;
    const defaultTerminalUrl = this.resolveDefaultTerminalUrl(defaultPlatform);
    const demoPassword = 'Demo@' + Math.floor(1000 + Math.random() * 9000);
    const initialBalance = '10000.00';
    const currency = (preferredCurrency || 'USD').toUpperCase();
    const leverage = '1:100';

    const newAccount: TradingAccountRecord = {
      id: accountId,
      account_number: accountNumber,
      user_id: userId,
      platform: defaultPlatform,
      account_type: 'standard',
      server_name: defaultServer,
      currency,
      leverage,
      status: 'active',
      nickname: 'Default Demo Account',
      is_demo: true,
      group_tier: `demo_${currency.toLowerCase()}`,
      investor_notes: null,
      admin_notes: 'System provisioned default demo account upon client registration',
      rejection_reason: null,
      approved_at: now,
      approved_by: 'SYSTEM',
      created_at: now,
      updated_at: now,
      password: demoPassword,
      balance: initialBalance,
      terminal_url: defaultTerminalUrl,
    };

    const pool = getPool();
    if (pool) {
      const serializedNotes = this.serializeMetadata(newAccount);
      await query(
        `INSERT INTO trading_accounts 
         (id, account_number, user_id, platform, account_type, server_name, currency, leverage, status, nickname, is_demo, group_tier, investor_notes, admin_notes, created_at, updated_at, approved_at, approved_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          newAccount.id,
          newAccount.account_number,
          newAccount.user_id,
          newAccount.platform,
          newAccount.account_type,
          newAccount.server_name,
          newAccount.currency,
          newAccount.leverage,
          newAccount.status,
          newAccount.nickname,
          newAccount.is_demo,
          newAccount.group_tier,
          serializedNotes,
          newAccount.admin_notes,
          newAccount.created_at,
          newAccount.updated_at,
          newAccount.approved_at,
          newAccount.approved_by,
        ]
      );
    } else {
      inMemoryDb.tradingAccounts.set(newAccount.id, { ...newAccount });
    }

    // Record audit log (WITHOUT PLAINTEXT PASSWORD)
    await this.recordAuditLog(
      userId,
      'DEMO_ACCOUNT_PROVISIONED',
      newAccount.id,
      {
        account_number: newAccount.account_number,
        platform: newAccount.platform,
        account_type: newAccount.account_type,
        currency: newAccount.currency,
        leverage: newAccount.leverage,
        balance: newAccount.balance,
        server_name: newAccount.server_name,
        status: newAccount.status,
        is_demo: true,
        terminal_url: newAccount.terminal_url,
      },
      ip,
      userAgent
    );

    return newAccount;
  }

  /**
   * Register a new trading account request for a user
   */
  public static async registerAccount(
    userId: string,
    input: RegisterTradingAccountInput,
    ip?: string,
    userAgent?: string
  ): Promise<TradingAccountRecord> {
    const now = new Date();
    const accountId = crypto.randomUUID();
    const accountNumber = this.generateAccountNumber(input.is_demo);
    const defaultServer = input.server_name || (input.is_demo ? `${input.platform}-Demo-Server` : `${input.platform}-Real-Server-1`);
    
    // Live accounts require administrative review/provisioning; demo accounts activate automatically
    const status: TradingAccountRecord['status'] = input.is_demo ? 'active' : 'pending_approval';
    const demoPassword = input.is_demo ? 'Demo@' + Math.floor(1000 + Math.random() * 9000) : null;
    const demoBalance = input.is_demo ? '10000.00' : '0.00';
    const terminalUrl = input.is_demo ? this.resolveDefaultTerminalUrl(input.platform) : null;

    const newAccount: TradingAccountRecord = {
      id: accountId,
      account_number: accountNumber,
      user_id: userId,
      platform: input.platform,
      account_type: input.account_type,
      server_name: defaultServer,
      currency: input.currency.toUpperCase(),
      leverage: input.leverage,
      status,
      nickname: input.nickname?.trim() || null,
      is_demo: input.is_demo,
      group_tier: `${input.account_type}_${input.currency.toLowerCase()}`,
      created_at: now,
      updated_at: now,
      approved_at: input.is_demo ? now : null,
      approved_by: input.is_demo ? 'SYSTEM' : null,
      password: demoPassword,
      balance: demoBalance,
      terminal_url: terminalUrl,
    };

    const pool = getPool();
    if (pool) {
      const serializedNotes = this.serializeMetadata(newAccount);
      await query(
        `INSERT INTO trading_accounts 
         (id, account_number, user_id, platform, account_type, server_name, currency, leverage, status, nickname, is_demo, group_tier, investor_notes, created_at, updated_at, approved_at, approved_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          newAccount.id,
          newAccount.account_number,
          newAccount.user_id,
          newAccount.platform,
          newAccount.account_type,
          newAccount.server_name,
          newAccount.currency,
          newAccount.leverage,
          newAccount.status,
          newAccount.nickname,
          newAccount.is_demo,
          newAccount.group_tier,
          serializedNotes,
          newAccount.created_at,
          newAccount.updated_at,
          newAccount.approved_at,
          newAccount.approved_by,
        ]
      );
    } else {
      inMemoryDb.tradingAccounts.set(newAccount.id, { ...newAccount });
    }

    await this.recordAuditLog(
      userId,
      'TRADING_ACCOUNT_REGISTERED',
      newAccount.id,
      {
        account_number: newAccount.account_number,
        platform: newAccount.platform,
        account_type: newAccount.account_type,
        currency: newAccount.currency,
        leverage: newAccount.leverage,
        is_demo: newAccount.is_demo,
        status: newAccount.status,
      },
      ip,
      userAgent
    );

    return newAccount;
  }

  /**
   * Link an existing external trading account to the user's CRM profile
   */
  public static async linkExistingAccount(
    userId: string,
    input: LinkTradingAccountInput,
    ip?: string,
    userAgent?: string
  ): Promise<TradingAccountRecord> {
    const cleanAccountNumber = input.account_number.trim();

    // Check for duplicate active linking
    const pool = getPool();
    if (pool) {
      const existing = await query<TradingAccountRecord>(
        `SELECT * FROM trading_accounts 
         WHERE account_number = $1 AND platform = $2 AND status != 'archived'`,
        [cleanAccountNumber, input.platform]
      );
      if (existing.length > 0) {
        throw new Error('This trading account number is already linked or pending review in the CRM');
      }
    } else {
      for (const acc of inMemoryDb.tradingAccounts.values()) {
        if (
          acc.account_number === cleanAccountNumber &&
          acc.platform === input.platform &&
          acc.status !== 'archived'
        ) {
          throw new Error('This trading account number is already linked or pending review in the CRM');
        }
      }
    }

    const now = new Date();
    const accountId = crypto.randomUUID();

    const linkedAccount: TradingAccountRecord = {
      id: accountId,
      account_number: cleanAccountNumber,
      user_id: userId,
      platform: input.platform,
      account_type: input.account_type,
      server_name: input.server_name.trim(),
      currency: input.currency.toUpperCase(),
      leverage: input.leverage,
      status: 'pending_approval',
      nickname: input.nickname?.trim() || null,
      is_demo: false,
      investor_notes: input.investor_notes?.trim() || null,
      group_tier: `${input.account_type}_${input.currency.toLowerCase()}`,
      created_at: now,
      updated_at: now,
    };

    if (pool) {
      await query(
        `INSERT INTO trading_accounts 
         (id, account_number, user_id, platform, account_type, server_name, currency, leverage, status, nickname, is_demo, investor_notes, group_tier, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          linkedAccount.id,
          linkedAccount.account_number,
          linkedAccount.user_id,
          linkedAccount.platform,
          linkedAccount.account_type,
          linkedAccount.server_name,
          linkedAccount.currency,
          linkedAccount.leverage,
          linkedAccount.status,
          linkedAccount.nickname,
          linkedAccount.is_demo,
          linkedAccount.investor_notes,
          linkedAccount.group_tier,
          linkedAccount.created_at,
          linkedAccount.updated_at,
        ]
      );
    } else {
      inMemoryDb.tradingAccounts.set(linkedAccount.id, linkedAccount);
    }

    await this.recordAuditLog(
      userId,
      'TRADING_ACCOUNT_LINK_REQUESTED',
      linkedAccount.id,
      {
        account_number: linkedAccount.account_number,
        platform: linkedAccount.platform,
        server_name: linkedAccount.server_name,
        currency: linkedAccount.currency,
        status: linkedAccount.status,
      },
      ip,
      userAgent
    );

    return linkedAccount;
  }

  /**
   * Get all trading accounts owned by a specific user (Client view)
   */
  public static async getUserAccounts(userId: string): Promise<TradingAccountRecord[]> {
    const pool = getPool();
    let accounts: TradingAccountRecord[] = [];

    if (pool) {
      const rows = await query<any>(
        `SELECT * FROM trading_accounts WHERE user_id = $1 AND status != 'archived' ORDER BY created_at DESC`,
        [userId]
      );
      accounts = rows.map((r) => this.hydrateAccountRecord(r));
    } else {
      const results: TradingAccountRecord[] = [];
      for (const acc of inMemoryDb.tradingAccounts.values()) {
        if (acc.user_id === userId && acc.status !== 'archived') {
          results.push(this.hydrateAccountRecord(acc));
        }
      }
      accounts = results.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    }

    // If client user has no accounts at all, automatically provision default demo account
    if (accounts.length === 0) {
      try {
        const defaultDemo = await this.provisionDefaultDemoAccount(userId);
        accounts = [defaultDemo];
      } catch (err) {
        console.error('Error auto-provisioning demo account for client:', err);
      }
    }

    return accounts;
  }

  /**
   * Get a single trading account by ID with strict IDOR ownership check
   */
  public static async getUserAccountById(
    userId: string,
    accountId: string
  ): Promise<TradingAccountRecord> {
    const account = await this.findRawAccount(accountId);
    if (!account) {
      const err: any = new Error('Trading account not found');
      err.statusCode = 404;
      throw err;
    }

    // IDOR Protection: Strictly check that the authenticated user owns this account
    if (account.user_id !== userId) {
      const err: any = new Error('Access forbidden: you do not have permission to access this trading account');
      err.statusCode = 403;
      throw err;
    }

    return account;
  }

  /**
   * Update nickname/display label of a trading account with strict IDOR ownership check
   */
  public static async updateUserAccountNickname(
    userId: string,
    accountId: string,
    nickname: string | null | undefined,
    ip?: string,
    userAgent?: string
  ): Promise<TradingAccountRecord> {
    const account = await this.getUserAccountById(userId, accountId); // Enforces IDOR check

    const updatedNickname = nickname?.trim() || null;
    const now = new Date();

    const pool = getPool();
    if (pool) {
      await query(
        `UPDATE trading_accounts SET nickname = $1, updated_at = $2 WHERE id = $3`,
        [updatedNickname, now, accountId]
      );
    } else {
      const record = inMemoryDb.tradingAccounts.get(accountId);
      if (record) {
        record.nickname = updatedNickname;
        record.updated_at = now;
      }
    }

    account.nickname = updatedNickname;
    account.updated_at = now;

    await this.recordAuditLog(
      userId,
      'TRADING_ACCOUNT_NICKNAME_UPDATED',
      accountId,
      {
        account_number: account.account_number,
        nickname: updatedNickname,
      },
      ip,
      userAgent
    );

    return account;
  }

  /**
   * Request leverage change on a trading account with strict IDOR ownership check
   */
  public static async requestLeverageChange(
    userId: string,
    accountId: string,
    requestedLeverage: string,
    reason?: string | null,
    ip?: string,
    userAgent?: string
  ): Promise<{ message: string; account: TradingAccountRecord }> {
    const account = await this.getUserAccountById(userId, accountId); // Enforces IDOR check

    if (account.status === 'archived' || account.status === 'disabled') {
      const err: any = new Error(`Cannot request leverage change on an account with status '${account.status}'`);
      err.statusCode = 400;
      throw err;
    }

    await this.recordAuditLog(
      userId,
      'TRADING_ACCOUNT_LEVERAGE_CHANGE_REQUESTED',
      accountId,
      {
        account_number: account.account_number,
        current_leverage: account.leverage,
        requested_leverage: requestedLeverage,
        reason: reason || null,
      },
      ip,
      userAgent
    );

    return {
      message: `Leverage change request to ${requestedLeverage} submitted for administrative review`,
      account,
    };
  }

  // =========================================================================
  // ADMIN WORKFLOWS
  // =========================================================================

  /**
   * List all trading accounts across the broker with search and filters (Admin view)
   */
  public static async getAllAccountsAdmin(filters: {
    status?: string;
    platform?: string;
    search?: string;
    user_id?: string;
  } = {}): Promise<TradingAccountWithOwner[]> {
    const pool = getPool();
    if (pool) {
      let sql = `
        SELECT ta.*, u.first_name, u.last_name, u.email, u.country
        FROM trading_accounts ta
        JOIN users u ON ta.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (filters.status) {
        params.push(filters.status);
        sql += ` AND ta.status = $${params.length}`;
      }
      if (filters.platform) {
        params.push(filters.platform);
        sql += ` AND ta.platform = $${params.length}`;
      }
      if (filters.user_id) {
        params.push(filters.user_id);
        sql += ` AND ta.user_id = $${params.length}`;
      }
      if (filters.search) {
        params.push(`%${filters.search.toLowerCase()}%`);
        sql += ` AND (LOWER(ta.account_number) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(ta.nickname) LIKE $${params.length})`;
      }

      sql += ` ORDER BY ta.created_at DESC`;
      const rows = await query<any>(sql, params);
      return rows.map((r) => {
        const hydrated = this.hydrateAccountRecord(r);
        return {
          ...hydrated,
          owner: {
            id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            email: r.email,
            country: r.country,
          },
        };
      });
    }

    const results: TradingAccountWithOwner[] = [];
    for (const acc of inMemoryDb.tradingAccounts.values()) {
      if (filters.status && acc.status !== filters.status) continue;
      if (filters.platform && acc.platform !== filters.platform) continue;
      if (filters.user_id && acc.user_id !== filters.user_id) continue;

      let owner: UserRecord | undefined = undefined;
      for (const u of inMemoryDb.users.values()) {
        if (u.id === acc.user_id) {
          owner = u;
          break;
        }
      }

      if (filters.search) {
        const term = filters.search.toLowerCase();
        const matchNum = acc.account_number.toLowerCase().includes(term);
        const matchNick = acc.nickname?.toLowerCase().includes(term);
        const matchEmail = owner?.email.toLowerCase().includes(term);
        if (!matchNum && !matchNick && !matchEmail) continue;
      }

      const hydrated = this.hydrateAccountRecord(acc);
      results.push({
        ...hydrated,
        owner: owner
          ? {
              id: owner.id,
              first_name: owner.first_name,
              last_name: owner.last_name,
              email: owner.email,
              country: owner.country,
            }
          : undefined,
      });
    }

    return results.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  /**
   * Get single trading account detail with owner and audit logs (Admin view)
   */
  public static async getAccountByIdAdmin(accountId: string): Promise<{
    account: TradingAccountWithOwner;
    audit_trail: AuditLogRecord[];
  }> {
    const account = await this.findRawAccount(accountId);
    if (!account) {
      const err: any = new Error('Trading account not found');
      err.statusCode = 404;
      throw err;
    }

    let owner: UserRecord | undefined = undefined;
    const pool = getPool();
    if (pool) {
      const userRows = await query<UserRecord>(`SELECT * FROM users WHERE id = $1`, [account.user_id]);
      owner = userRows[0];
    } else {
      for (const u of inMemoryDb.users.values()) {
        if (u.id === account.user_id) {
          owner = u;
          break;
        }
      }
    }

    let auditLogs: AuditLogRecord[] = [];
    if (pool) {
      auditLogs = await query<AuditLogRecord>(
        `SELECT * FROM audit_logs WHERE entity_type = 'trading_account' AND entity_id = $1 ORDER BY created_at DESC`,
        [accountId]
      );
    } else {
      auditLogs = inMemoryDb.auditLogs.filter(
        (log) => log.entity_type === 'trading_account' && log.entity_id === accountId
      );
    }

    return {
      account: {
        ...account,
        owner: owner
          ? {
              id: owner.id,
              first_name: owner.first_name,
              last_name: owner.last_name,
              email: owner.email,
              country: owner.country,
            }
          : undefined,
      },
      audit_trail: auditLogs,
    };
  }

  /**
   * Approve a pending trading account (Admin workflow)
   */
  public static async approveAccount(
    adminId: string,
    accountId: string,
    input: ApproveTradingAccountInput,
    ip?: string,
    userAgent?: string
  ): Promise<TradingAccountRecord> {
    const account = await this.findRawAccount(accountId);
    if (!account) {
      const err: any = new Error('Trading account not found');
      err.statusCode = 404;
      throw err;
    }

    if (account.status === 'active') {
      const err: any = new Error('This trading account is already active');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const updatedAccountNumber = input.account_number?.trim() || account.account_number;
    const updatedServer = input.server_name?.trim() || account.server_name;
    const updatedGroupTier = input.group_tier?.trim() || account.group_tier;
    const adminNotes = input.admin_notes?.trim() || account.admin_notes;

    const pool = getPool();
    if (pool) {
      await query(
        `UPDATE trading_accounts 
         SET status = 'active', account_number = $1, server_name = $2, group_tier = $3, admin_notes = $4, approved_at = $5, approved_by = $6, updated_at = $5
         WHERE id = $7`,
        [updatedAccountNumber, updatedServer, updatedGroupTier, adminNotes, now, adminId, accountId]
      );
    } else {
      const record = inMemoryDb.tradingAccounts.get(accountId);
      if (record) {
        record.status = 'active';
        record.account_number = updatedAccountNumber;
        record.server_name = updatedServer;
        record.group_tier = updatedGroupTier;
        record.admin_notes = adminNotes;
        record.approved_at = now;
        record.approved_by = adminId;
        record.updated_at = now;
      }
    }

    account.status = 'active';
    account.account_number = updatedAccountNumber;
    account.server_name = updatedServer;
    account.group_tier = updatedGroupTier;
    account.admin_notes = adminNotes;
    account.approved_at = now;
    account.approved_by = adminId;
    account.updated_at = now;

    await this.recordAuditLog(
      adminId,
      'TRADING_ACCOUNT_APPROVED',
      accountId,
      {
        account_number: account.account_number,
        server_name: account.server_name,
        group_tier: account.group_tier,
        admin_notes: adminNotes,
      },
      ip,
      userAgent
    );

    await NotificationService.createNotification(
      account.user_id,
      'Trading Account Approved',
      `Your trading account #${account.account_number} (${account.platform}) is now active.`,
      'trading_account',
      { account_id: account.id, account_number: account.account_number, platform: account.platform }
    );

    return account;
  }

  /**
   * Reject a pending trading account (Admin workflow)
   */
  public static async rejectAccount(
    adminId: string,
    accountId: string,
    input: RejectTradingAccountInput,
    ip?: string,
    userAgent?: string
  ): Promise<TradingAccountRecord> {
    const account = await this.findRawAccount(accountId);
    if (!account) {
      const err: any = new Error('Trading account not found');
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    const rejectionReason = input.rejection_reason.trim();
    const adminNotes = input.admin_notes?.trim() || account.admin_notes;

    const pool = getPool();
    if (pool) {
      await query(
        `UPDATE trading_accounts 
         SET status = 'disabled', rejection_reason = $1, admin_notes = $2, updated_at = $3
         WHERE id = $4`,
        [rejectionReason, adminNotes, now, accountId]
      );
    } else {
      const record = inMemoryDb.tradingAccounts.get(accountId);
      if (record) {
        record.status = 'disabled';
        record.rejection_reason = rejectionReason;
        record.admin_notes = adminNotes;
        record.updated_at = now;
      }
    }

    account.status = 'disabled';
    account.rejection_reason = rejectionReason;
    account.admin_notes = adminNotes;
    account.updated_at = now;

    await this.recordAuditLog(
      adminId,
      'TRADING_ACCOUNT_REJECTED',
      accountId,
      {
        account_number: account.account_number,
        rejection_reason: rejectionReason,
        admin_notes: adminNotes,
      },
      ip,
      userAgent
    );

    await NotificationService.createNotification(
      account.user_id,
      'Trading Account Application Rejected',
      `Your trading account registration was rejected. Reason: ${rejectionReason}`,
      'trading_account',
      { account_id: account.id, rejection_reason: rejectionReason }
    );

    return account;
  }

  /**
   * Change account status (e.g. active, read_only, disabled, archived) (Admin workflow)
   */
  public static async updateAccountStatus(
    adminId: string,
    accountId: string,
    newStatus: TradingAccountRecord['status'],
    adminNotes?: string | null,
    ip?: string,
    userAgent?: string
  ): Promise<TradingAccountRecord> {
    const account = await this.findRawAccount(accountId);
    if (!account) {
      const err: any = new Error('Trading account not found');
      err.statusCode = 404;
      throw err;
    }

    const oldStatus = account.status;
    const now = new Date();
    const notes = adminNotes?.trim() || account.admin_notes;

    const pool = getPool();
    if (pool) {
      await query(
        `UPDATE trading_accounts SET status = $1, admin_notes = $2, updated_at = $3 WHERE id = $4`,
        [newStatus, notes, now, accountId]
      );
    } else {
      const record = inMemoryDb.tradingAccounts.get(accountId);
      if (record) {
        record.status = newStatus;
        record.admin_notes = notes;
        record.updated_at = now;
      }
    }

    account.status = newStatus;
    account.admin_notes = notes;
    account.updated_at = now;

    await this.recordAuditLog(
      adminId,
      'TRADING_ACCOUNT_STATUS_CHANGED',
      accountId,
      {
        account_number: account.account_number,
        previous_status: oldStatus,
        new_status: newStatus,
        admin_notes: notes,
      },
      ip,
      userAgent
    );

    return account;
  }

  /**
   * Update trading account metadata such as login, password, platform, server name, leverage, balance, status, terminal URL, etc. (Admin workflow)
   */
  public static async updateMetadataAdmin(
    adminId: string,
    accountId: string,
    input: AdminUpdateTradingAccountMetadataInput,
    ip?: string,
    userAgent?: string
  ): Promise<TradingAccountRecord> {
    const account = await this.findRawAccount(accountId);
    if (!account) {
      const err: any = new Error('Trading account not found');
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    const updatedAccountNumber = input.account_number?.trim() || account.account_number;
    const updatedPlatform = input.platform?.trim() || account.platform;
    const updatedServer = input.server_name !== undefined ? input.server_name?.trim() || '' : account.server_name;
    const updatedCurrency = input.currency ? input.currency.trim().toUpperCase() : account.currency;
    const updatedLeverage = input.leverage || account.leverage;
    const updatedBalance = input.balance !== undefined ? input.balance.trim() : (account.balance || (account.is_demo ? '10000.00' : '0.00'));
    const updatedStatus = input.status || account.status;
    const updatedTerminalUrl = input.terminal_url !== undefined ? input.terminal_url?.trim() || null : (account.terminal_url || null);
    const updatedGroupTier = input.group_tier !== undefined ? input.group_tier?.trim() || null : account.group_tier;
    const updatedType = input.account_type || account.account_type;
    const updatedAdminNotes = input.admin_notes !== undefined ? input.admin_notes?.trim() || null : account.admin_notes;
    const updatedNickname = input.nickname !== undefined ? input.nickname?.trim() || null : account.nickname;
    const updatedPassword = input.password !== undefined ? input.password?.trim() || null : account.password;

    account.account_number = updatedAccountNumber;
    account.platform = updatedPlatform;
    account.server_name = updatedServer;
    account.currency = updatedCurrency;
    account.leverage = updatedLeverage;
    account.balance = updatedBalance;
    account.status = updatedStatus;
    account.terminal_url = updatedTerminalUrl;
    account.group_tier = updatedGroupTier;
    account.account_type = updatedType;
    account.admin_notes = updatedAdminNotes;
    account.nickname = updatedNickname;
    account.password = updatedPassword;
    account.updated_at = now;

    const pool = getPool();
    if (pool) {
      const serializedNotes = this.serializeMetadata(account);
      await query(
        `UPDATE trading_accounts 
         SET account_number = $1, platform = $2, server_name = $3, currency = $4, leverage = $5, status = $6, group_tier = $7, account_type = $8, admin_notes = $9, nickname = $10, investor_notes = $11, updated_at = $12
         WHERE id = $13`,
        [
          updatedAccountNumber,
          updatedPlatform,
          updatedServer,
          updatedCurrency,
          updatedLeverage,
          updatedStatus,
          updatedGroupTier,
          updatedType,
          updatedAdminNotes,
          updatedNickname,
          serializedNotes,
          now,
          accountId,
        ]
      );
    } else {
      const record = inMemoryDb.tradingAccounts.get(accountId);
      if (record) {
        Object.assign(record, account);
      }
    }

    // Audit log: TRADING_ACCOUNT_METADATA_UPDATED (CRITICAL: NEVER LOG PLAINTEXT PASSWORDS)
    await this.recordAuditLog(
      adminId,
      'TRADING_ACCOUNT_METADATA_UPDATED',
      accountId,
      {
        account_number: account.account_number,
        platform: account.platform,
        server_name: account.server_name,
        currency: account.currency,
        leverage: account.leverage,
        balance: account.balance,
        status: account.status,
        terminal_url: account.terminal_url,
        group_tier: account.group_tier,
        account_type: account.account_type,
        password_changed: input.password !== undefined,
        admin_notes: updatedAdminNotes,
      },
      ip,
      userAgent
    );

    return account;
  }

  /**
   * Updates balance of a trading account (used by financial transfer approval workflow)
   */
  public static async updateAccountBalance(
    accountId: string,
    newBalance: string
  ): Promise<TradingAccountRecord> {
    const account = await this.findRawAccount(accountId);
    if (!account) {
      const err: any = new Error('Trading account not found');
      err.statusCode = 404;
      throw err;
    }
    const now = new Date();
    account.balance = newBalance;
    account.updated_at = now;

    const pool = getPool();
    if (pool) {
      const serializedNotes = this.serializeMetadata(account);
      try {
        await query(
          `UPDATE trading_accounts 
           SET balance = $1, investor_notes = $2, updated_at = $3
           WHERE id = $4`,
          [newBalance, serializedNotes, now, accountId]
        );
      } catch (err: any) {
        await query(
          `UPDATE trading_accounts 
           SET investor_notes = $1, updated_at = $2
           WHERE id = $3`,
          [serializedNotes, now, accountId]
        );
      }
    } else {
      const record = inMemoryDb.tradingAccounts.get(accountId);
      if (record) {
        record.balance = newBalance;
        record.updated_at = now;
        record.investor_notes = this.serializeMetadata(record);
      }
    }

    return account;
  }

  /**
   * Helper to fetch an account record without ownership checks (for admin & internal service operations)
   */
  public static async findRawAccount(accountId: string): Promise<TradingAccountRecord | null> {
    const pool = getPool();
    if (pool) {
      const rows = await query<any>(
        `SELECT * FROM trading_accounts WHERE id = $1`,
        [accountId]
      );
      return rows[0] ? this.hydrateAccountRecord(rows[0]) : null;
    }

    const record = inMemoryDb.tradingAccounts.get(accountId);
    return record ? this.hydrateAccountRecord(record) : null;
  }

  /**
   * Admin-only trading account deletion or archiving.
   * Checks for ownership, pending transfers, active balance, and financial history.
   * If the trading account has financial transfer history, it is archived to preserve
   * immutable ledger records for regulatory compliance.
   * If it has no financial history, it is cleanly deleted.
   */
  public static async deleteAccountAdmin(
    adminUserId: string,
    accountId: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ success: boolean; action: 'deleted' | 'archived'; message: string; account_id: string }> {
    const pool = getPool();
    if (pool) {
      const accRows = await query<any>(`SELECT * FROM trading_accounts WHERE id = $1`, [accountId]);
      if (accRows.length === 0) {
        const err: any = new Error('Trading account not found');
        err.statusCode = 404;
        throw err;
      }
      const rawAccount = accRows[0];
      const account = this.hydrateAccountRecord(rawAccount);

      // 1. Check pending transfers
      const pendingTransfers = await query<any>(
        `SELECT id FROM account_transfers WHERE trading_account_id = $1 AND status = 'pending'`,
        [accountId]
      );
      if (pendingTransfers.length > 0) {
        const err: any = new Error('Cannot delete trading account with pending transfer requests. Please approve or reject pending transfers first.');
        err.statusCode = 400;
        throw err;
      }

      // 2. Check active balance on live account
      if (!account.is_demo && parseFloat(account.balance || '0') > 0) {
        const err: any = new Error(`Cannot delete trading account with active balance (${account.balance} ${account.currency}). Transfer or settle balance first.`);
        err.statusCode = 400;
        throw err;
      }

      // 3. Check transfer history
      const transferCountRows = await query<any>(
        `SELECT COUNT(*) as count FROM account_transfers WHERE trading_account_id = $1`,
        [accountId]
      );
      const transferCount = parseInt(transferCountRows[0]?.count || '0', 10);

      if (transferCount > 0) {
        // Soft-delete: archive account to retain transfer ledger trail
        const now = new Date();
        const meta = this.parseMetadata(rawAccount);
        meta.archived_at = now.toISOString();
        meta.archived_by = adminUserId;
        meta.archive_reason = 'Archived via admin delete workflow to retain transfer history';
        const serialized = this.serializeMetadata(meta);

        await query(
          `UPDATE trading_accounts SET status = 'archived', investor_notes = $1, updated_at = $2 WHERE id = $3`,
          [serialized, now, accountId]
        );

        await this.recordAuditLog(
          adminUserId,
          'TRADING_ACCOUNT_ARCHIVED',
          accountId,
          {
            account_id: accountId,
            account_number: account.account_number,
            user_id: account.user_id,
            transfer_count_retained: transferCount,
            reason: 'Account archived to preserve financial transfer ledger history',
          },
          ip,
          userAgent
        );

        return {
          success: true,
          action: 'archived',
          message: 'Trading account archived. Financial transfer history has been preserved for regulatory compliance.',
          account_id: accountId,
        };
      } else {
        // Clean deletion
        await query(`DELETE FROM trading_password_resets WHERE trading_account_id = $1`, [accountId]);
        await query(`DELETE FROM trading_accounts WHERE id = $1`, [accountId]);

        await this.recordAuditLog(
          adminUserId,
          'TRADING_ACCOUNT_DELETED',
          accountId,
          {
            account_id: accountId,
            account_number: account.account_number,
            user_id: account.user_id,
            reason: 'Trading account deleted with zero prior transfer history',
          },
          ip,
          userAgent
        );

        return {
          success: true,
          action: 'deleted',
          message: 'Trading account deleted successfully.',
          account_id: accountId,
        };
      }
    } else {
      const record = inMemoryDb.tradingAccounts.get(accountId);
      if (!record) {
        const err: any = new Error('Trading account not found');
        err.statusCode = 404;
        throw err;
      }
      const account = this.hydrateAccountRecord(record);

      const pendingTransfers = Array.from(inMemoryDb.accountTransfers.values()).filter(
        (tr) => tr.trading_account_id === accountId && tr.status === 'pending'
      );
      if (pendingTransfers.length > 0) {
        const err: any = new Error('Cannot delete trading account with pending transfer requests. Please approve or reject pending transfers first.');
        err.statusCode = 400;
        throw err;
      }

      if (!account.is_demo && parseFloat(account.balance || '0') > 0) {
        const err: any = new Error(`Cannot delete trading account with active balance (${account.balance} ${account.currency}). Transfer or settle balance first.`);
        err.statusCode = 400;
        throw err;
      }

      const transferCount = Array.from(inMemoryDb.accountTransfers.values()).filter(
        (tr) => tr.trading_account_id === accountId
      ).length;

      if (transferCount > 0) {
        record.status = 'archived';
        record.updated_at = new Date();
        const meta = this.parseMetadata(record);
        meta.archived_at = new Date().toISOString();
        meta.archived_by = adminUserId;
        meta.archive_reason = 'Archived via admin delete workflow to retain transfer history';
        record.investor_notes = this.serializeMetadata(meta);

        await this.recordAuditLog(
          adminUserId,
          'TRADING_ACCOUNT_ARCHIVED',
          accountId,
          {
            account_id: accountId,
            account_number: account.account_number,
            user_id: account.user_id,
            transfer_count_retained: transferCount,
            reason: 'Account archived to preserve financial transfer ledger history',
          },
          ip,
          userAgent
        );

        return {
          success: true,
          action: 'archived',
          message: 'Trading account archived. Financial transfer history has been preserved for regulatory compliance.',
          account_id: accountId,
        };
      } else {
        for (const [id, r] of inMemoryDb.tradingPasswordResets.entries()) {
          if (r.trading_account_id === accountId) inMemoryDb.tradingPasswordResets.delete(id);
        }
        inMemoryDb.tradingAccounts.delete(accountId);

        await this.recordAuditLog(
          adminUserId,
          'TRADING_ACCOUNT_DELETED',
          accountId,
          {
            account_id: accountId,
            account_number: account.account_number,
            user_id: account.user_id,
            reason: 'Trading account deleted with zero prior transfer history',
          },
          ip,
          userAgent
        );

        return {
          success: true,
          action: 'deleted',
          message: 'Trading account deleted successfully.',
          account_id: accountId,
        };
      }
    }
  }

  /**
   * Admin-only assignment / mapping of a trading account to a client.
   * Verifies target client exists and is a client, updates user_id mapping,
   * and records an audit log.
   */
  public static async assignAccountToClientAdmin(
    adminUserId: string,
    accountId: string,
    targetClientId: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ account: TradingAccountWithOwner; audit_trail: AuditLogRecord[] }> {
    const pool = getPool();
    let previousUserId = '';
    let accountNum = '';

    if (pool) {
      // Check target client
      const clientRows = await query<any>(`SELECT id, role, email FROM users WHERE id = $1`, [targetClientId]);
      if (clientRows.length === 0 || clientRows[0].role !== 'client') {
        const err: any = new Error('Target client account not found');
        err.statusCode = 404;
        throw err;
      }

      const accRows = await query<any>(`SELECT * FROM trading_accounts WHERE id = $1`, [accountId]);
      if (accRows.length === 0) {
        const err: any = new Error('Trading account not found');
        err.statusCode = 404;
        throw err;
      }
      previousUserId = accRows[0].user_id;
      accountNum = accRows[0].account_number;

      await query(
        `UPDATE trading_accounts SET user_id = $1, updated_at = NOW() WHERE id = $2`,
        [targetClientId, accountId]
      );
    } else {
      const targetUser = Array.from(inMemoryDb.users.values()).find((u) => u.id === targetClientId);
      if (!targetUser || targetUser.role !== 'client') {
        const err: any = new Error('Target client account not found');
        err.statusCode = 404;
        throw err;
      }

      const record = inMemoryDb.tradingAccounts.get(accountId);
      if (!record) {
        const err: any = new Error('Trading account not found');
        err.statusCode = 404;
        throw err;
      }
      previousUserId = record.user_id;
      accountNum = record.account_number;

      record.user_id = targetClientId;
      record.updated_at = new Date();
    }

    await this.recordAuditLog(
      adminUserId,
      'TRADING_ACCOUNT_ASSIGNED',
      accountId,
      {
        account_id: accountId,
        account_number: accountNum,
        previous_user_id: previousUserId,
        new_user_id: targetClientId,
      },
      ip,
      userAgent
    );

    const updated = await this.getAccountByIdAdmin(accountId);
    return updated;
  }

  /**
   * Client-side trading password reset REQUEST workflow.
   * Strict IDOR protection: verified against requesting user's account.
   * Does NOT change password automatically; creates a pending request for admin review.
   */
  public static async requestPasswordReset(
    userId: string,
    accountId: string,
    reason?: string,
    ip?: string,
    userAgent?: string
  ): Promise<TradingPasswordResetRecord> {
    const account = await this.getUserAccountById(userId, accountId);
    if (!account) {
      const err: any = new Error('Trading account not found');
      err.statusCode = 404;
      throw err;
    }

    if (account.status === 'archived' || account.status === 'disabled') {
      const err: any = new Error(`Cannot request password reset for account with status '${account.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    const pool = getPool();
    const requestId = crypto.randomUUID();
    const now = new Date();

    if (pool) {
      const existingPending = await query<any>(
        `SELECT id FROM trading_password_resets WHERE trading_account_id = $1 AND status = 'pending'`,
        [accountId]
      );
      if (existingPending.length > 0) {
        const err: any = new Error('A password reset request for this trading account is already pending administrative review.');
        err.statusCode = 400;
        throw err;
      }

      const rows = await query<any>(
        `INSERT INTO trading_password_resets (id, trading_account_id, user_id, account_number, status, reason, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, $6)
         RETURNING *`,
        [requestId, accountId, userId, account.account_number, reason?.trim() || null, now]
      );

      await this.recordAuditLog(
        userId,
        'TRADING_PASSWORD_RESET_REQUESTED',
        accountId,
        {
          request_id: requestId,
          account_id: accountId,
          account_number: account.account_number,
          reason: reason?.trim() || null,
        },
        ip,
        userAgent
      );

      await NotificationService.createNotification(
        userId,
        'Trading Password Reset Requested',
        `Your password reset request for trading account #${account.account_number} has been submitted and is pending administrative review.`,
        'trading_account',
        { account_id: accountId, request_id: requestId }
      );

      return rows[0];
    } else {
      const existingPending = Array.from(inMemoryDb.tradingPasswordResets.values()).find(
        (r) => r.trading_account_id === accountId && r.status === 'pending'
      );
      if (existingPending) {
        const err: any = new Error('A password reset request for this trading account is already pending administrative review.');
        err.statusCode = 400;
        throw err;
      }

      const record: TradingPasswordResetRecord = {
        id: requestId,
        trading_account_id: accountId,
        user_id: userId,
        account_number: account.account_number,
        status: 'pending',
        reason: reason?.trim() || null,
        admin_notes: null,
        processed_by: null,
        processed_at: null,
        created_at: now,
        updated_at: now,
      };

      inMemoryDb.tradingPasswordResets.set(requestId, record);

      await this.recordAuditLog(
        userId,
        'TRADING_PASSWORD_RESET_REQUESTED',
        accountId,
        {
          request_id: requestId,
          account_id: accountId,
          account_number: account.account_number,
          reason: reason?.trim() || null,
        },
        ip,
        userAgent
      );

      await NotificationService.createNotification(
        userId,
        'Trading Password Reset Requested',
        `Your password reset request for trading account #${account.account_number} has been submitted and is pending administrative review.`,
        'trading_account',
        { account_id: accountId, request_id: requestId }
      );

      return record;
    }
  }

  /**
   * Client: List own trading account password reset requests
   */
  public static async getUserPasswordResets(userId: string): Promise<TradingPasswordResetRecord[]> {
    const pool = getPool();
    if (pool) {
      const rows = await query<any>(
        `SELECT * FROM trading_password_resets WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      return rows;
    } else {
      return Array.from(inMemoryDb.tradingPasswordResets.values())
        .filter((r) => r.user_id === userId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }

  /**
   * Admin: List all password reset requests with user and account metadata
   */
  public static async getAllPasswordResetsAdmin(filters?: {
    status?: string;
    search?: string;
  }): Promise<any[]> {
    const pool = getPool();
    if (pool) {
      let sql = `
        SELECT r.*,
               u.first_name as client_first_name, u.last_name as client_last_name, u.email as client_email,
               ta.platform, ta.server_name, ta.is_demo, ta.currency, ta.balance
        FROM trading_password_resets r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN trading_accounts ta ON ta.id = r.trading_account_id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (filters?.status) {
        params.push(filters.status);
        sql += ` AND r.status = $${params.length}`;
      }
      if (filters?.search) {
        params.push(`%${filters.search.toLowerCase()}%`);
        sql += ` AND (LOWER(r.account_number) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(u.first_name) LIKE $${params.length} OR LOWER(u.last_name) LIKE $${params.length})`;
      }
      sql += ` ORDER BY r.created_at DESC`;
      return await query<any>(sql, params);
    } else {
      let list = Array.from(inMemoryDb.tradingPasswordResets.values());
      if (filters?.status) {
        list = list.filter((r) => r.status === filters.status);
      }
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        list = list.filter((r) => {
          const user = Array.from(inMemoryDb.users.values()).find((u) => u.id === r.user_id);
          return (
            r.account_number.toLowerCase().includes(s) ||
            (user && (user.email.toLowerCase().includes(s) || user.first_name.toLowerCase().includes(s) || user.last_name.toLowerCase().includes(s)))
          );
        });
      }

      return list
        .map((r) => {
          const user = Array.from(inMemoryDb.users.values()).find((u) => u.id === r.user_id);
          const ta = inMemoryDb.tradingAccounts.get(r.trading_account_id);
          return {
            ...r,
            client_first_name: user?.first_name || '',
            client_last_name: user?.last_name || '',
            client_email: user?.email || '',
            platform: ta?.platform || '',
            server_name: ta?.server_name || '',
            is_demo: ta?.is_demo || false,
            currency: ta?.currency || 'USD',
            balance: ta?.balance || '0.00',
          };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }

  /**
   * Admin: Process password reset request (approve or reject)
   */
  public static async processPasswordResetAdmin(
    adminUserId: string,
    requestId: string,
    action: 'approve' | 'reject',
    input?: {
      new_password?: string;
      admin_notes?: string;
      rejection_reason?: string;
    },
    ip?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string; data: any; new_password?: string | null }> {
    const pool = getPool();
    const now = new Date();

    if (pool) {
      const rows = await query<any>(`SELECT * FROM trading_password_resets WHERE id = $1`, [requestId]);
      if (rows.length === 0) {
        const err: any = new Error('Password reset request not found');
        err.statusCode = 404;
        throw err;
      }
      const resetReq = rows[0];
      if (resetReq.status !== 'pending') {
        const err: any = new Error('This password reset request has already been processed');
        err.statusCode = 400;
        throw err;
      }

      const accRows = await query<any>(`SELECT * FROM trading_accounts WHERE id = $1`, [resetReq.trading_account_id]);
      const rawAccount = accRows[0];
      const account = rawAccount ? this.hydrateAccountRecord(rawAccount) : null;

      if (action === 'approve') {
        const adminNotes = input?.admin_notes?.trim() || 'Password reset approved by operations desk';
        await query(
          `UPDATE trading_password_resets
           SET status = 'approved', processed_by = $1, processed_at = $2, admin_notes = $3, updated_at = $2
           WHERE id = $4`,
          [adminUserId, now, adminNotes, requestId]
        );

        // If demo account and a new password was supplied, update demo credentials
        if (account && account.is_demo && input?.new_password) {
          const meta = this.parseMetadata(rawAccount);
          meta.demo_password = input.new_password;
          const serialized = this.serializeMetadata(meta);
          await query(
            `UPDATE trading_accounts SET investor_notes = $1, updated_at = $2 WHERE id = $3`,
            [serialized, now, account.id]
          );
        }

        // Live account: Never store plaintext live password in database or audit logs
        await this.recordAuditLog(
          adminUserId,
          'TRADING_PASSWORD_RESET_APPROVED',
          resetReq.trading_account_id,
          {
            request_id: requestId,
            account_number: resetReq.account_number,
            is_demo: account?.is_demo ?? false,
            admin_notes: adminNotes,
          },
          ip,
          userAgent
        );

        await NotificationService.createNotification(
          resetReq.user_id,
          'Trading Password Reset Approved',
          `Your password reset request for trading account #${resetReq.account_number} has been approved.${input?.admin_notes ? ` Note: ${input.admin_notes}` : ''}`,
          'trading_account',
          { account_id: resetReq.trading_account_id, request_id: requestId }
        );

        return {
          success: true,
          message: 'Password reset request approved.',
          data: { ...resetReq, status: 'approved', processed_by: adminUserId, processed_at: now, admin_notes: adminNotes },
          new_password: input?.new_password || null,
        };
      } else {
        const reason = input?.rejection_reason?.trim() || input?.admin_notes?.trim() || 'Request rejected by administrator';
        await query(
          `UPDATE trading_password_resets
           SET status = 'rejected', processed_by = $1, processed_at = $2, admin_notes = $3, updated_at = $2
           WHERE id = $4`,
          [adminUserId, now, reason, requestId]
        );

        await this.recordAuditLog(
          adminUserId,
          'TRADING_PASSWORD_RESET_REJECTED',
          resetReq.trading_account_id,
          {
            request_id: requestId,
            account_number: resetReq.account_number,
            rejection_reason: reason,
          },
          ip,
          userAgent
        );

        await NotificationService.createNotification(
          resetReq.user_id,
          'Trading Password Reset Rejected',
          `Your password reset request for trading account #${resetReq.account_number} was rejected. Reason: ${reason}`,
          'trading_account',
          { account_id: resetReq.trading_account_id, request_id: requestId }
        );

        return {
          success: true,
          message: 'Password reset request rejected.',
          data: { ...resetReq, status: 'rejected', processed_by: adminUserId, processed_at: now, admin_notes: reason },
        };
      }
    } else {
      const resetReq = inMemoryDb.tradingPasswordResets.get(requestId);
      if (!resetReq) {
        const err: any = new Error('Password reset request not found');
        err.statusCode = 404;
        throw err;
      }
      if (resetReq.status !== 'pending') {
        const err: any = new Error('This password reset request has already been processed');
        err.statusCode = 400;
        throw err;
      }

      const rawAccount = inMemoryDb.tradingAccounts.get(resetReq.trading_account_id);
      const account = rawAccount ? this.hydrateAccountRecord(rawAccount) : null;

      if (action === 'approve') {
        const adminNotes = input?.admin_notes?.trim() || 'Password reset approved by operations desk';
        resetReq.status = 'approved';
        resetReq.processed_by = adminUserId;
        resetReq.processed_at = now;
        resetReq.admin_notes = adminNotes;
        resetReq.updated_at = now;

        if (account && account.is_demo && input?.new_password) {
          const meta = this.parseMetadata(rawAccount);
          meta.demo_password = input.new_password;
          rawAccount.investor_notes = this.serializeMetadata(meta);
          rawAccount.updated_at = now;
        }

        await this.recordAuditLog(
          adminUserId,
          'TRADING_PASSWORD_RESET_APPROVED',
          resetReq.trading_account_id,
          {
            request_id: requestId,
            account_number: resetReq.account_number,
            is_demo: account?.is_demo ?? false,
            admin_notes: adminNotes,
          },
          ip,
          userAgent
        );

        await NotificationService.createNotification(
          resetReq.user_id,
          'Trading Password Reset Approved',
          `Your password reset request for trading account #${resetReq.account_number} has been approved.${input?.admin_notes ? ` Note: ${input.admin_notes}` : ''}`,
          'trading_account',
          { account_id: resetReq.trading_account_id, request_id: requestId }
        );

        return {
          success: true,
          message: 'Password reset request approved.',
          data: resetReq,
          new_password: input?.new_password || null,
        };
      } else {
        const reason = input?.rejection_reason?.trim() || input?.admin_notes?.trim() || 'Request rejected by administrator';
        resetReq.status = 'rejected';
        resetReq.processed_by = adminUserId;
        resetReq.processed_at = now;
        resetReq.admin_notes = reason;
        resetReq.updated_at = now;

        await this.recordAuditLog(
          adminUserId,
          'TRADING_PASSWORD_RESET_REJECTED',
          resetReq.trading_account_id,
          {
            request_id: requestId,
            account_number: resetReq.account_number,
            rejection_reason: reason,
          },
          ip,
          userAgent
        );

        await NotificationService.createNotification(
          resetReq.user_id,
          'Trading Password Reset Rejected',
          `Your password reset request for trading account #${resetReq.account_number} was rejected. Reason: ${reason}`,
          'trading_account',
          { account_id: resetReq.trading_account_id, request_id: requestId }
        );

        return {
          success: true,
          message: 'Password reset request rejected.',
          data: resetReq,
        };
      }
    }
  }
}

