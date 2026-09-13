import crypto from 'crypto';
import {
  getPool,
  query,
  inMemoryDb,
  TradingAccountRecord,
  UserRecord,
  AuditLogRecord,
} from '../db/client';
import { NotificationService } from './notification.service';
import {
  RegisterTradingAccountInput,
  LinkTradingAccountInput,
  ApproveTradingAccountInput,
  RejectTradingAccountInput,
  AdminUpdateTradingAccountMetadataInput,
} from '../middleware/validation';

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

    if (pool) {
      await query(
        `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [auditId, actorId, action, 'trading_account', targetId, JSON.stringify(details), ip || null, userAgent || null, now]
      );
    } else {
      const record: AuditLogRecord = {
        id: auditId,
        actor_id: actorId,
        action,
        entity_type: 'trading_account',
        entity_id: targetId,
        details,
        ip_address: ip || null,
        user_agent: userAgent || null,
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
    };

    const pool = getPool();
    if (pool) {
      await query(
        `INSERT INTO trading_accounts 
         (id, account_number, user_id, platform, account_type, server_name, currency, leverage, status, nickname, is_demo, group_tier, created_at, updated_at, approved_at, approved_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
          newAccount.created_at,
          newAccount.updated_at,
          newAccount.approved_at,
          newAccount.approved_by,
        ]
      );
    } else {
      inMemoryDb.tradingAccounts.set(newAccount.id, newAccount);
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
    if (pool) {
      return await query<TradingAccountRecord>(
        `SELECT * FROM trading_accounts WHERE user_id = $1 AND status != 'archived' ORDER BY created_at DESC`,
        [userId]
      );
    }

    const results: TradingAccountRecord[] = [];
    for (const acc of inMemoryDb.tradingAccounts.values()) {
      if (acc.user_id === userId && acc.status !== 'archived') {
        results.push({ ...acc });
      }
    }
    return results.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
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
      return rows.map((r) => ({
        id: r.id,
        account_number: r.account_number,
        user_id: r.user_id,
        platform: r.platform,
        account_type: r.account_type,
        server_name: r.server_name,
        currency: r.currency,
        leverage: r.leverage,
        status: r.status,
        nickname: r.nickname,
        is_demo: r.is_demo,
        group_tier: r.group_tier,
        investor_notes: r.investor_notes,
        admin_notes: r.admin_notes,
        rejection_reason: r.rejection_reason,
        approved_at: r.approved_at ? new Date(r.approved_at) : null,
        approved_by: r.approved_by,
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
        owner: {
          id: r.user_id,
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email,
          country: r.country,
        },
      }));
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

      results.push({
        ...acc,
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
   * Update trading account metadata such as leverage, server name, or account type (Admin workflow)
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
    const updatedLeverage = input.leverage || account.leverage;
    const updatedServer = input.server_name?.trim() || account.server_name;
    const updatedGroupTier = input.group_tier !== undefined ? input.group_tier?.trim() || null : account.group_tier;
    const updatedType = input.account_type || account.account_type;
    const updatedAdminNotes = input.admin_notes?.trim() || account.admin_notes;

    const pool = getPool();
    if (pool) {
      await query(
        `UPDATE trading_accounts 
         SET leverage = $1, server_name = $2, group_tier = $3, account_type = $4, admin_notes = $5, updated_at = $6
         WHERE id = $7`,
        [updatedLeverage, updatedServer, updatedGroupTier, updatedType, updatedAdminNotes, now, accountId]
      );
    } else {
      const record = inMemoryDb.tradingAccounts.get(accountId);
      if (record) {
        record.leverage = updatedLeverage;
        record.server_name = updatedServer;
        record.group_tier = updatedGroupTier;
        record.account_type = updatedType;
        record.admin_notes = updatedAdminNotes;
        record.updated_at = now;
      }
    }

    account.leverage = updatedLeverage;
    account.server_name = updatedServer;
    account.group_tier = updatedGroupTier;
    account.account_type = updatedType;
    account.admin_notes = updatedAdminNotes;
    account.updated_at = now;

    await this.recordAuditLog(
      adminId,
      'TRADING_ACCOUNT_METADATA_UPDATED',
      accountId,
      {
        account_number: account.account_number,
        leverage: account.leverage,
        server_name: account.server_name,
        group_tier: account.group_tier,
        account_type: account.account_type,
        admin_notes: updatedAdminNotes,
      },
      ip,
      userAgent
    );

    return account;
  }

  /**
   * Internal helper to fetch an account record without ownership checks
   */
  private static async findRawAccount(accountId: string): Promise<TradingAccountRecord | null> {
    const pool = getPool();
    if (pool) {
      const rows = await query<TradingAccountRecord>(
        `SELECT * FROM trading_accounts WHERE id = $1`,
        [accountId]
      );
      return rows[0] || null;
    }

    const record = inMemoryDb.tradingAccounts.get(accountId);
    return record ? { ...record } : null;
  }
}
