import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { inMemoryDb, getPool, query, UserRecord, PasswordResetRecord, AuditLogRecord, DatabaseGuard } from '../db/client';
import { generateToken } from '../middleware/auth';
import { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput } from '../middleware/validation';
import { MailService } from './mail.service';
import { NotificationService } from './notification.service';

export class AuthService {
  /**
   * Records an audit log entry for authentication and security lifecycle events
   */
  public static async recordAuditLog(
    actorId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
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
        [auditId, actorId, action, entityType, entityId, JSON.stringify(details), sanitizedIp, sanitizedUserAgent, now]
      );
    } else {
      const record: AuditLogRecord = {
        id: auditId,
        actor_id: actorId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        ip_address: sanitizedIp,
        user_agent: sanitizedUserAgent,
        created_at: now,
      };
      inMemoryDb.auditLogs.unshift(record);
    }
  }

  /**
   * Register a new user with standard 'client' role and password hashing
   */
  public static async register(input: RegisterInput, ip?: string, userAgent?: string) {
    const emailNormalized = input.email.toLowerCase();

    // Check existing email
    if (getPool()) {
      const existing = await query<UserRecord>('SELECT id FROM users WHERE email = $1', [emailNormalized]);
      if (existing.length > 0) {
        throw new Error('An account with this email already exists');
      }
    } else {
      if (inMemoryDb.users.has(emailNormalized)) {
        throw new Error('An account with this email already exists');
      }
    }

    // Hash password with bcrypt (salt rounds = 10)
    const passwordHash = await bcrypt.hash(input.password, 10);
    const userId = crypto.randomUUID();
    const now = new Date();

    const newUser: UserRecord = {
      id: userId,
      email: emailNormalized,
      password_hash: passwordHash,
      role: 'client',
      status: 'active',
      first_name: input.first_name,
      last_name: input.last_name,
      country: input.country || 'US',
      phone: input.phone || null,
      preferred_currency: input.preferred_currency || 'USD',
      created_at: now,
      updated_at: now,
    };

    if (getPool()) {
      await query(
        `INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, country, phone, preferred_currency, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          newUser.id,
          newUser.email,
          newUser.password_hash,
          newUser.role,
          newUser.status,
          newUser.first_name,
          newUser.last_name,
          newUser.country,
          newUser.phone,
          newUser.preferred_currency,
          newUser.created_at,
          newUser.updated_at,
        ]
      );

      // Create primary wallet
      await query(
        `INSERT INTO wallets (id, user_id, currency, balance, reserved_balance, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [crypto.randomUUID(), newUser.id, newUser.preferred_currency, '0.00', '0.00', now, now]
      );
    } else {
      inMemoryDb.users.set(emailNormalized, newUser);
      const userWallet: any = {
        id: crypto.randomUUID(),
        user_id: newUser.id,
        currency: newUser.preferred_currency,
        balance: '0.00',
        reserved_balance: '0.00',
        created_at: now,
        updated_at: now,
      };
      inMemoryDb.wallets.set(userWallet.id, userWallet);
      inMemoryDb.wallets.set(`${userWallet.user_id}_${userWallet.currency}`, userWallet);
    }

    const token = generateToken(newUser);

    await this.recordAuditLog(
      newUser.id,
      'USER_REGISTERED',
      'user',
      newUser.id,
      {
        email: newUser.email,
        role: newUser.role,
        country: newUser.country,
        preferred_currency: newUser.preferred_currency,
      },
      ip,
      userAgent
    );

    return {
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        preferred_currency: newUser.preferred_currency,
      },
    };
  }

  /**
   * Authenticate user with password comparison and generate token
   */
  public static async login(input: LoginInput, ip?: string, userAgent?: string) {
    const emailNormalized = input.email.toLowerCase();
    let user: UserRecord | null = null;

    if (getPool()) {
      const rows = await query<UserRecord>('SELECT * FROM users WHERE email = $1', [emailNormalized]);
      user = rows[0] || null;
    } else {
      user = inMemoryDb.users.get(emailNormalized) || null;
    }

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new Error(`Your account is currently ${user.status}. Please contact support.`);
    }

    // Verify password hash
    const isValid = await bcrypt.compare(input.password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    const now = new Date();
    user.last_login_at = now;
    if (getPool()) {
      await query('UPDATE users SET last_login_at = $1 WHERE id = $2', [now, user.id]);
    }

    const token = generateToken(user);

    await this.recordAuditLog(
      user.id,
      'USER_LOGIN',
      'user',
      user.id,
      {
        email: user.email,
        role: user.role,
      },
      ip,
      userAgent
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        first_name: user.first_name,
        last_name: user.last_name,
        preferred_currency: user.preferred_currency,
      },
    };
  }

  /**
   * Request a password reset token
   */
  public static async forgotPassword(input: ForgotPasswordInput, ip?: string, userAgent?: string) {
    const emailNormalized = input.email.toLowerCase();
    let userExists = false;

    if (getPool()) {
      const rows = await query('SELECT id FROM users WHERE email = $1', [emailNormalized]);
      userExists = rows.length > 0;
    } else {
      userExists = inMemoryDb.users.has(emailNormalized);
    }

    await this.recordAuditLog(
      null,
      'PASSWORD_RESET_REQUESTED',
      'user',
      null,
      { email: emailNormalized, user_exists: userExists },
      ip,
      userAgent
    );

    // Return generic response to prevent account enumeration
    if (!userExists) {
      return {
        message: 'If an account exists with that email, a password reset link has been dispatched.',
      };
    }

    // Invalidate previous active unexpired reset tokens for this email
    if (getPool()) {
      await query('UPDATE password_resets SET used_at = NOW() WHERE email = $1 AND used_at IS NULL', [emailNormalized]);
    } else {
      for (const rec of inMemoryDb.passwordResets.values()) {
        if (rec.email === emailNormalized && !rec.used_at) {
          rec.used_at = new Date();
        }
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const resetRecord: PasswordResetRecord = {
      id: crypto.randomUUID(),
      email: emailNormalized,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: new Date(),
    };

    if (getPool()) {
      await query(
        `INSERT INTO password_resets (id, email, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [resetRecord.id, resetRecord.email, resetRecord.token_hash, resetRecord.expires_at, resetRecord.created_at]
      );
    } else {
      inMemoryDb.passwordResets.set(tokenHash, resetRecord);
    }

    // Send reset link via MailService (or log diagnostic if unconfigured)
    await MailService.sendPasswordResetEmail(emailNormalized, rawToken);

    // Production safe: NEVER return raw token or demoResetToken in the API response
    return {
      message: 'If an account exists with that email, a password reset link has been dispatched.',
    };
  }

  /**
   * Complete password reset using valid unexpired token
   */
  public static async resetPassword(input: ResetPasswordInput, ip?: string, userAgent?: string) {
    if (!input.token || input.token.trim() === '') {
      throw new Error('Invalid or expired password reset token');
    }

    const tokenHash = crypto.createHash('sha256').update(input.token.trim()).digest('hex');
    let email: string | null = null;
    let resetId: string | null = null;

    if (getPool()) {
      const rows = await query<PasswordResetRecord>(
        'SELECT * FROM password_resets WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL',
        [tokenHash]
      );
      if (rows.length > 0) {
        email = rows[0].email;
        resetId = rows[0].id;
      }
    } else {
      const record = inMemoryDb.passwordResets.get(tokenHash);
      if (record && record.expires_at > new Date() && !record.used_at) {
        email = record.email;
        resetId = record.id;
      }
    }

    if (!email || !resetId) {
      throw new Error('Invalid or expired password reset token');
    }

    const newPasswordHash = await bcrypt.hash(input.password, 10);
    const now = new Date();

    if (getPool()) {
      await query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE email = $3', [
        newPasswordHash,
        now,
        email,
      ]);
      await query('UPDATE password_resets SET used_at = $1 WHERE id = $2', [now, resetId]);
      await query('UPDATE password_resets SET used_at = $1 WHERE email = $2 AND used_at IS NULL', [now, email]);
    } else {
      const user = inMemoryDb.users.get(email);
      if (user) {
        user.password_hash = newPasswordHash;
        user.updated_at = now;
      }
      const record = inMemoryDb.passwordResets.get(tokenHash);
      if (record) {
        record.used_at = now;
      }
      for (const rec of inMemoryDb.passwordResets.values()) {
        if (rec.email === email && !rec.used_at) {
          rec.used_at = now;
        }
      }
    }

    let targetUserId: string | null = null;
    if (getPool()) {
      const userRows = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
      targetUserId = userRows[0]?.id || null;
    } else {
      const u = inMemoryDb.users.get(email);
      targetUserId = u ? u.id : null;
    }

    await this.recordAuditLog(
      targetUserId,
      'PASSWORD_RESET_COMPLETED',
      'user',
      targetUserId,
      { email },
      ip,
      userAgent
    );

    return {
      message: 'Your password has been successfully updated. You may now log in.',
    };
  }

  /**
   * Check if at least one administrator account exists in the system
   */
  public static async hasAdmin(): Promise<boolean> {
    if (getPool()) {
      const admins = await query<UserRecord>("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      return admins.length > 0;
    } else {
      const admins = Array.from(inMemoryDb.users.values()).filter((u) => u.role === 'admin');
      return admins.length > 0;
    }
  }

  /**
   * Explicit Initial Admin Setup
   * Only allowed when zero admin accounts exist in the system (initial bootstrap).
   * Enforces environment-variable-based setup secret (ADMIN_SETUP_SECRET) in production.
   */
  public static async setupAdmin(
    input: RegisterInput,
    providedSecret?: string,
    ip?: string,
    userAgent?: string
  ) {
    const configuredSecret = process.env.ADMIN_SETUP_SECRET;
    const isProd = DatabaseGuard.isProduction();

    // In production, public setup without a configured secret is strictly forbidden
    if (isProd && (!configuredSecret || configuredSecret.trim() === '')) {
      throw new Error(
        'Public initial admin setup is disabled in production. Configure ADMIN_SETUP_SECRET in environment variables or use a secure CLI setup script.'
      );
    }

    // Validate setup secret if configured
    if (configuredSecret && configuredSecret.trim() !== '') {
      if (!providedSecret || providedSecret.trim() !== configuredSecret.trim()) {
        throw new Error('Invalid or missing administrator setup secret');
      }
    }

    const adminExists = await this.hasAdmin();
    if (adminExists) {
      throw new Error('An administrator account has already been initialized. Administrator setup is permanently closed.');
    }

    const emailNormalized = input.email.toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 10);
    const adminId = crypto.randomUUID();
    const now = new Date();

    const newAdmin: UserRecord = {
      id: adminId,
      email: emailNormalized,
      password_hash: passwordHash,
      role: 'admin',
      status: 'active',
      first_name: input.first_name || 'System',
      last_name: input.last_name || 'Administrator',
      country: input.country || 'US',
      phone: input.phone || null,
      preferred_currency: input.preferred_currency || 'USD',
      email_verified_at: now,
      created_at: now,
      updated_at: now,
    };

    if (getPool()) {
      await query(
        `INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, country, phone, preferred_currency, email_verified_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          newAdmin.id,
          newAdmin.email,
          newAdmin.password_hash,
          newAdmin.role,
          newAdmin.status,
          newAdmin.first_name,
          newAdmin.last_name,
          newAdmin.country,
          newAdmin.phone,
          newAdmin.preferred_currency,
          newAdmin.email_verified_at,
          newAdmin.created_at,
          newAdmin.updated_at,
        ]
      );
    } else {
      inMemoryDb.users.set(emailNormalized, newAdmin);
    }

    const token = generateToken(newAdmin);

    // Notice: providedSecret is intentionally NOT recorded in audit log or details
    await this.recordAuditLog(
      newAdmin.id,
      'ADMIN_INITIALIZED',
      'user',
      newAdmin.id,
      {
        email: newAdmin.email,
        role: newAdmin.role,
      },
      ip,
      userAgent
    );

    return {
      token,
      user: {
        id: newAdmin.id,
        email: newAdmin.email,
        role: newAdmin.role,
        status: newAdmin.status,
        first_name: newAdmin.first_name,
        last_name: newAdmin.last_name,
        preferred_currency: newAdmin.preferred_currency,
      },
    };
  }

  // =========================================================================
  // BROKER BACK OFFICE: OPERATIONS DASHBOARD & CLIENT INSPECTOR METHODS
  // =========================================================================

  private static defaultBrokerSettings = {
    broker_name: 'ForexCore Broker',
    legal_entity_name: 'ForexCore Financial Services Ltd',
    support_email: 'support@forexcore.com',
    contact_phone: '+44 20 7946 0912',
    default_currency: 'USD',
    default_leverage: '1:100',
    max_leverage: '1:500',
    accent_color: '#8b5cf6',
    allowed_registrations: true,
    kyc_required_for_withdrawals: true,
    updated_at: new Date().toISOString(),
  };

  public static async getBrokerSettings() {
    const pool = getPool();
    if (pool) {
      try {
        const rows = await query<any>(
          `SELECT value, updated_at FROM system_settings WHERE key = 'broker_settings'`
        );
        if (rows.length > 0 && rows[0].value) {
          return {
            ...this.defaultBrokerSettings,
            ...rows[0].value,
            updated_at: rows[0].updated_at ? new Date(rows[0].updated_at).toISOString() : new Date().toISOString(),
          };
        }
      } catch (err: any) {
        console.warn('[BROKER_SETTINGS] Notice: Could not read persistent broker settings, using defaults:', err?.message || err);
      }
      return { ...this.defaultBrokerSettings };
    } else {
      const stored = inMemoryDb.systemSettings.get('broker_settings');
      if (stored) {
        return { ...this.defaultBrokerSettings, ...stored };
      }
      return { ...this.defaultBrokerSettings };
    }
  }

  public static async updateBrokerSettings(
    newSettings: Partial<typeof AuthService.defaultBrokerSettings>,
    adminUserId?: string,
    ip?: string,
    userAgent?: string
  ) {
    const currentSettings = await this.getBrokerSettings();
    const updatedSettings = {
      ...currentSettings,
      ...newSettings,
      updated_at: new Date().toISOString(),
    };

    const pool = getPool();
    if (pool) {
      await query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('broker_settings', $1, NOW())
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(updatedSettings)]
      );
    } else {
      inMemoryDb.systemSettings.set('broker_settings', updatedSettings);
    }

    await this.recordAuditLog(
      adminUserId || null,
      'BROKER_SETTINGS_UPDATED',
      'system_config',
      'broker_settings',
      { updated_fields: Object.keys(newSettings) },
      ip,
      userAgent
    );

    return updatedSettings;
  }

  /**
   * Retrieve aggregate real KPIs and top urgent attention queues for Broker Back Office
   */
  public static async getDashboardKpis() {
    const pool = getPool();
    if (pool) {
      const countsResult = await query<any>(
        `SELECT
           (SELECT COUNT(*)::int FROM users WHERE LOWER(role) = 'client') AS total_clients,
           (SELECT COUNT(*)::int FROM users WHERE LOWER(role) = 'client' AND status = 'active') AS active_clients,
           (SELECT COUNT(*)::int FROM kyc_profiles WHERE status IN ('pending', 'under_review')) AS pending_kyc,
           (SELECT COUNT(*)::int FROM deposits WHERE status = 'pending') AS pending_deposits,
           (SELECT COUNT(*)::int FROM withdrawals WHERE status = 'pending') AS pending_withdrawals,
           (SELECT COUNT(*)::int FROM support_tickets WHERE status IN ('open', 'in_progress')) AS open_support_tickets,
           (SELECT COUNT(*)::int FROM trading_accounts WHERE status = 'active') AS active_trading_accounts`
      );
      const row = countsResult[0] || {};

      const urgentDeposits = await query<any>(
        `SELECT d.id, d.reference_no, d.amount, d.currency, d.created_at, d.payment_method_name,
                u.first_name, u.last_name, u.email
         FROM deposits d
         JOIN users u ON u.id = d.user_id
         WHERE d.status = 'pending'
         ORDER BY d.created_at ASC LIMIT 5`
      );

      const urgentWithdrawals = await query<any>(
        `SELECT w.id, w.reference_no, w.amount, w.currency, w.created_at, w.payment_method_name,
                u.first_name, u.last_name, u.email
         FROM withdrawals w
         JOIN users u ON u.id = w.user_id
         WHERE w.status = 'pending'
         ORDER BY w.created_at ASC LIMIT 5`
      );

      const urgentKyc = await query<any>(
        `SELECT kp.id, kp.user_id, kp.first_name, kp.last_name, kp.status, kp.submitted_at,
                u.email, u.country
         FROM kyc_profiles kp
         JOIN users u ON u.id = kp.user_id
         WHERE kp.status IN ('pending', 'under_review')
         ORDER BY kp.submitted_at ASC LIMIT 5`
      );

      return {
        kpis: {
          total_clients: Number(row.total_clients) || 0,
          active_clients: Number(row.active_clients) || 0,
          pending_kyc: Number(row.pending_kyc) || 0,
          pending_deposits: Number(row.pending_deposits) || 0,
          pending_withdrawals: Number(row.pending_withdrawals) || 0,
          open_support_tickets: Number(row.open_support_tickets) || 0,
          active_trading_accounts: Number(row.active_trading_accounts) || 0,
        },
        urgent: {
          deposits: urgentDeposits,
          withdrawals: urgentWithdrawals,
          kyc: urgentKyc,
        },
      };
    } else {
      const allClients = Array.from(inMemoryDb.users.values()).filter(
        (u) => (u.role || '').toLowerCase() === 'client'
      );
      const activeClients = allClients.filter((u) => u.status === 'active');
      const pendingKyc = Array.from(inMemoryDb.kycProfiles.values()).filter(
        (kp) => kp.status === 'pending' || kp.status === 'under_review'
      );
      const pendingDeposits = Array.from(inMemoryDb.deposits.values()).filter((d) => d.status === 'pending');
      const pendingWithdrawals = Array.from(inMemoryDb.withdrawals.values()).filter((w) => w.status === 'pending');
      const openSupportTickets = Array.from(inMemoryDb.supportTickets.values()).filter(
        (st) => st.status === 'open' || st.status === 'in_progress'
      );
      const activeTradingAccounts = Array.from(inMemoryDb.tradingAccounts.values()).filter(
        (ta) => ta.status === 'active'
      );

      const urgentDeposits = pendingDeposits.slice(0, 5).map((d) => {
        const u = Array.from(inMemoryDb.users.values()).find((usr) => usr.id === d.user_id);
        return {
          id: d.id,
          reference_no: d.reference_no,
          amount: d.amount,
          currency: d.currency,
          created_at: d.created_at,
          payment_method_name: d.payment_method_name,
          first_name: u?.first_name || 'Client',
          last_name: u?.last_name || '',
          email: u?.email || '',
        };
      });

      const urgentWithdrawals = pendingWithdrawals.slice(0, 5).map((w) => {
        const u = Array.from(inMemoryDb.users.values()).find((usr) => usr.id === w.user_id);
        return {
          id: w.id,
          reference_no: w.reference_no,
          amount: w.amount,
          currency: w.currency,
          created_at: w.created_at,
          payment_method_name: w.payment_method_name,
          first_name: u?.first_name || 'Client',
          last_name: u?.last_name || '',
          email: u?.email || '',
        };
      });

      const urgentKycList = pendingKyc.slice(0, 5).map((kp) => {
        const u = Array.from(inMemoryDb.users.values()).find((usr) => usr.id === kp.user_id);
        return {
          id: kp.id,
          user_id: kp.user_id,
          first_name: kp.first_name,
          last_name: kp.last_name,
          status: kp.status,
          submitted_at: kp.submitted_at,
          email: u?.email || '',
          country: kp.country || u?.country || '',
        };
      });

      return {
        kpis: {
          total_clients: allClients.length,
          active_clients: activeClients.length,
          pending_kyc: pendingKyc.length,
          pending_deposits: pendingDeposits.length,
          pending_withdrawals: pendingWithdrawals.length,
          open_support_tickets: openSupportTickets.length,
          active_trading_accounts: activeTradingAccounts.length,
        },
        urgent: {
          deposits: urgentDeposits,
          withdrawals: urgentWithdrawals,
          kyc: urgentKycList,
        },
      };
    }
  }

  /**
   * List all registered client users with their KYC status, primary wallet, and trading account totals
   */
  public static async listClients(filter?: { search?: string; status?: string; kycStatus?: string }) {
    const pool = getPool();
    let clients: Array<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      country: string;
      phone: string | null;
      preferred_currency: string;
      status: string;
      kyc_status: string;
      wallet_balance: string;
      wallet_reserved_balance: string;
      trading_accounts_count: number;
      created_at: Date;
      last_login_at?: Date | null;
    }> = [];

    if (pool) {
      const rows = await query<any>(
        `SELECT
           u.id, u.email, u.first_name, u.last_name, u.country, u.phone,
           u.preferred_currency, u.status, u.created_at, u.last_login_at,
           kp.status AS kyc_status,
           w.balance AS wallet_balance,
           w.reserved_balance AS wallet_reserved_balance,
           (SELECT COUNT(*)::int FROM trading_accounts ta WHERE ta.user_id = u.id) AS trading_accounts_count
         FROM users u
         LEFT JOIN kyc_profiles kp ON kp.user_id = u.id
         LEFT JOIN wallets w ON w.user_id = u.id
         WHERE LOWER(u.role) = 'client'
         ORDER BY u.created_at DESC`
      );
      clients = rows.map((r) => ({
        id: r.id,
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        country: r.country,
        phone: r.phone || null,
        preferred_currency: r.preferred_currency,
        status: r.status,
        kyc_status: r.kyc_status || 'unsubmitted',
        wallet_balance: r.wallet_balance || '0.00',
        wallet_reserved_balance: r.wallet_reserved_balance || '0.00',
        trading_accounts_count: Number(r.trading_accounts_count) || 0,
        created_at: r.created_at,
        last_login_at: r.last_login_at,
      }));
    } else {
      const usersList = Array.from(inMemoryDb.users.values()).filter(
        (u) => (u.role || '').toLowerCase() === 'client'
      );
      clients = usersList.map((c) => {
        const kyc = Array.from(inMemoryDb.kycProfiles.values()).find((kp) => kp.user_id === c.id);
        const wallet = Array.from(inMemoryDb.wallets.values()).find((w) => w.user_id === c.id);
        const accountCount = Array.from(inMemoryDb.tradingAccounts.values()).filter(
          (ta) => ta.user_id === c.id
        ).length;
        return {
          id: c.id,
          email: c.email,
          first_name: c.first_name,
          last_name: c.last_name,
          country: c.country,
          phone: c.phone || null,
          preferred_currency: c.preferred_currency,
          status: c.status,
          kyc_status: kyc ? kyc.status : 'unsubmitted',
          wallet_balance: wallet ? wallet.balance : '0.00',
          wallet_reserved_balance: wallet ? wallet.reserved_balance : '0.00',
          trading_accounts_count: accountCount,
          created_at: c.created_at,
          last_login_at: c.last_login_at,
        };
      });
    }

    // In-memory / result filtering for search, status, and kyc
    if (filter) {
      if (filter.search && filter.search.trim() !== '') {
        const q = filter.search.trim().toLowerCase();
        clients = clients.filter(
          (c) =>
            c.id.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.first_name.toLowerCase().includes(q) ||
            c.last_name.toLowerCase().includes(q)
        );
      }
      if (filter.status && filter.status !== 'all') {
        clients = clients.filter((c) => c.status === filter.status);
      }
      if (filter.kycStatus && filter.kycStatus !== 'all') {
        clients = clients.filter((c) => c.kyc_status === filter.kycStatus);
      }
    }

    return clients;
  }

  /**
   * 360° Client Inspector Profile
   * Comprehensive operational view combining identity, KYC, wallet, accounts, transactions, and tickets.
   */
  public static async getClient360(clientId: string) {
    const pool = getPool();
    if (pool) {
      const userRows = await query<any>(
        `SELECT id, email, first_name, last_name, country, phone, preferred_currency, status, created_at, updated_at, last_login_at
         FROM users WHERE id = $1 AND LOWER(role) = 'client'`,
        [clientId]
      );
      if (userRows.length === 0) throw new Error('Client account not found');
      const client = userRows[0];

      const walletRows = await query<any>(
        `SELECT id, currency, balance, reserved_balance, created_at, updated_at FROM wallets WHERE user_id = $1`,
        [clientId]
      );
      const wallet = walletRows[0] || {
        id: null,
        currency: client.preferred_currency,
        balance: '0.00',
        reserved_balance: '0.00',
      };

      const tradingAccounts = await query<any>(
        `SELECT id, account_number, platform, account_type, server_name, currency, leverage, status, nickname, is_demo, group_tier, created_at
         FROM trading_accounts WHERE user_id = $1 ORDER BY created_at DESC`,
        [clientId]
      );

      const kycProfileRows = await query<any>(
        `SELECT * FROM kyc_profiles WHERE user_id = $1`,
        [clientId]
      );
      const kycProfile = kycProfileRows[0] || null;

      const kycDocs = await query<any>(
        `SELECT id, document_type, original_filename, file_size, mime_type, status, rejection_reason, created_at
         FROM kyc_documents WHERE user_id = $1 ORDER BY created_at DESC`,
        [clientId]
      );

      const deposits = await query<any>(
        `SELECT id, reference_no, amount, currency, status, payment_method_name, created_at, approved_at, rejected_at, rejection_reason
         FROM deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [clientId]
      );

      const withdrawals = await query<any>(
        `SELECT id, reference_no, amount, currency, status, payment_method_name, created_at, approved_at, rejected_at, rejection_reason
         FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [clientId]
      );

      const supportTickets = await query<any>(
        `SELECT id, ticket_no, subject, category, priority, status, created_at, last_reply_at
         FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [clientId]
      );

      const auditLogs = await query<any>(
        `SELECT id, action, entity_type, entity_id, details, created_at
         FROM audit_logs WHERE (entity_type = 'user' AND entity_id = $1) OR actor_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [clientId]
      );

      return {
        client,
        wallet,
        trading_accounts: tradingAccounts,
        kyc_profile: kycProfile,
        kyc_documents: kycDocs,
        recent_deposits: deposits,
        recent_withdrawals: withdrawals,
        support_tickets: supportTickets,
        audit_logs: auditLogs,
      };
    } else {
      const client = Array.from(inMemoryDb.users.values()).find(
        (u) => u.id === clientId && (u.role || '').toLowerCase() === 'client'
      );
      if (!client) throw new Error('Client account not found');

      const wallet = Array.from(inMemoryDb.wallets.values()).find((w) => w.user_id === clientId) || {
        id: null,
        currency: client.preferred_currency,
        balance: '0.00',
        reserved_balance: '0.00',
      };

      const tradingAccounts = Array.from(inMemoryDb.tradingAccounts.values())
        .filter((ta) => ta.user_id === clientId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const kycProfile = Array.from(inMemoryDb.kycProfiles.values()).find((kp) => kp.user_id === clientId) || null;
      const kycDocs = Array.from(inMemoryDb.kycDocuments.values())
        .filter((kd) => kd.user_id === clientId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const deposits = Array.from(inMemoryDb.deposits.values())
        .filter((d) => d.user_id === clientId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      const withdrawals = Array.from(inMemoryDb.withdrawals.values())
        .filter((w) => w.user_id === clientId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      const supportTickets = Array.from(inMemoryDb.supportTickets.values())
        .filter((st) => st.user_id === clientId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      const auditLogs = inMemoryDb.auditLogs
        .filter((al) => (al.entity_type === 'user' && al.entity_id === clientId) || al.actor_id === clientId)
        .slice(0, 10);

      return {
        client: {
          id: client.id,
          email: client.email,
          first_name: client.first_name,
          last_name: client.last_name,
          country: client.country,
          phone: client.phone || null,
          preferred_currency: client.preferred_currency,
          status: client.status,
          created_at: client.created_at,
          updated_at: client.updated_at,
          last_login_at: client.last_login_at,
        },
        wallet,
        trading_accounts: tradingAccounts,
        kyc_profile: kycProfile,
        kyc_documents: kycDocs,
        recent_deposits: deposits,
        recent_withdrawals: withdrawals,
        support_tickets: supportTickets,
        audit_logs: auditLogs,
      };
    }
  }

  /**
   * Admin updates client status (active, suspended, pending) with mandatory audit logging and client notification
   */
  public static async updateClientStatus(
    adminUserId: string,
    clientId: string,
    status: 'active' | 'suspended' | 'pending',
    reason?: string,
    ip?: string,
    userAgent?: string
  ) {
    const pool = getPool();
    let previousStatus = 'unknown';

    if (pool) {
      const existing = await query<any>('SELECT status FROM users WHERE id = $1 AND LOWER(role) = $2', [
        clientId,
        'client',
      ]);
      if (existing.length === 0) throw new Error('Client account not found');
      previousStatus = existing[0].status;

      await query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 AND LOWER(role) = $3', [
        status,
        clientId,
        'client',
      ]);
    } else {
      const u = Array.from(inMemoryDb.users.values()).find(
        (usr) => usr.id === clientId && (usr.role || '').toLowerCase() === 'client'
      );
      if (!u) throw new Error('Client account not found');
      previousStatus = u.status;
      u.status = status;
      u.updated_at = new Date();
    }

    await this.recordAuditLog(
      adminUserId,
      'CLIENT_STATUS_UPDATED',
      'user',
      clientId,
      {
        previous_status: previousStatus,
        new_status: status,
        reason: reason || 'Administrative action',
      },
      ip,
      userAgent
    );

    await NotificationService.createNotification(
      clientId,
      'Account Status Updated',
      `Your account status has been updated to ${status.toUpperCase()}.${reason ? ` Reason: ${reason}` : ''}`,
      'system',
      { previous_status: previousStatus, new_status: status, reason }
    );

    return { success: true, clientId, status, previousStatus };
  }

  /**
   * Broadcast notification to all clients or send to a specific client
   */
  public static async broadcastNotification(
    adminUserId: string,
    input: {
      title: string;
      message: string;
      type?: 'system' | 'trading_account' | 'support_ticket';
      target: 'all' | 'specific_user';
      user_id?: string;
    },
    ip?: string,
    userAgent?: string
  ) {
    const title = input.title?.trim();
    const message = input.message?.trim();
    if (!title || !message) throw new Error('Title and message are required');

    let dispatchCount = 0;
    const notificationType = input.type || 'system';

    if (input.target === 'specific_user') {
      if (!input.user_id) throw new Error('user_id is required for specific user target');
      await NotificationService.createNotification(
        input.user_id,
        title,
        message,
        notificationType,
        { broadcast_by: adminUserId }
      );
      dispatchCount = 1;
    } else {
      const clients = await this.listClients();
      for (const client of clients) {
        await NotificationService.createNotification(
          client.id,
          title,
          message,
          notificationType,
          { broadcast_by: adminUserId }
        );
        dispatchCount++;
      }
    }

    await this.recordAuditLog(
      adminUserId,
      'NOTIFICATION_BROADCAST_SENT',
      'notification',
      null,
      {
        title,
        target: input.target,
        user_id: input.user_id || null,
        dispatch_count: dispatchCount,
      },
      ip,
      userAgent
    );

    return { success: true, dispatch_count: dispatchCount };
  }

  /**
   * =========================================================================
   * STAFF ADMINISTRATOR MANAGEMENT (Strict 2-Tier: client, admin)
   * =========================================================================
   */

  /**
   * List all staff administrators
   */
  public static async listStaffAdmins() {
    const pool = getPool();
    if (pool) {
      const rows = await query<any>(
        `SELECT id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at
         FROM users
         WHERE LOWER(role) = 'admin'
         ORDER BY created_at ASC`
      );
      return rows.map((r) => ({
        id: r.id,
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        role: 'admin' as const,
        status: r.status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        last_login_at: r.last_login_at,
      }));
    } else {
      const admins = Array.from(inMemoryDb.users.values()).filter(
        (u) => (u.role || '').toLowerCase() === 'admin'
      );
      return admins.map((a) => ({
        id: a.id,
        email: a.email,
        first_name: a.first_name,
        last_name: a.last_name,
        role: 'admin' as const,
        status: a.status,
        created_at: a.created_at,
        updated_at: a.updated_at,
        last_login_at: a.last_login_at,
      }));
    }
  }

  /**
   * Provision a new staff administrator by an authenticated admin
   */
  public static async createStaffAdmin(
    actorAdminId: string,
    payload: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
    },
    ip?: string,
    userAgent?: string
  ) {
    const emailNormalized = payload.email.trim().toLowerCase();
    if (!emailNormalized || !payload.password) {
      throw new Error('Email and password are required');
    }
    if (payload.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const pool = getPool();
    if (pool) {
      const existing = await query<UserRecord>('SELECT id FROM users WHERE email = $1', [emailNormalized]);
      if (existing.length > 0) {
        throw new Error('A user with this email already exists');
      }
    } else {
      const existing = Array.from(inMemoryDb.users.values()).some(
        (u) => u.email.toLowerCase() === emailNormalized
      );
      if (existing) {
        throw new Error('A user with this email already exists');
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(payload.password, salt);
    const newAdminId = crypto.randomUUID();
    const now = new Date();

    if (pool) {
      await query(
        `INSERT INTO users (
          id, email, password_hash, role, status, first_name, last_name, country, preferred_currency, email_verified_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          newAdminId,
          emailNormalized,
          passwordHash,
          'admin',
          'active',
          payload.first_name || 'Staff',
          payload.last_name || 'Admin',
          'US',
          'USD',
          now,
          now,
          now,
        ]
      );
    } else {
      const newAdmin: UserRecord = {
        id: newAdminId,
        email: emailNormalized,
        password_hash: passwordHash,
        role: 'admin',
        status: 'active',
        first_name: payload.first_name || 'Staff',
        last_name: payload.last_name || 'Admin',
        country: 'US',
        preferred_currency: 'USD',
        email_verified_at: now,
        created_at: now,
        updated_at: now,
      };
      inMemoryDb.users.set(newAdminId, newAdmin);
    }

    await this.recordAuditLog(
      actorAdminId,
      'STAFF_ADMIN_PROVISIONED',
      'user',
      newAdminId,
      {
        email: emailNormalized,
        first_name: payload.first_name,
        last_name: payload.last_name,
        provisioned_by: actorAdminId,
      },
      ip,
      userAgent
    );

    return {
      id: newAdminId,
      email: emailNormalized,
      first_name: payload.first_name,
      last_name: payload.last_name,
      role: 'admin' as const,
      status: 'active' as const,
      created_at: now,
    };
  }

  /**
   * Activate or deactivate staff admin status
   */
  public static async setStaffAdminStatus(
    actorAdminId: string,
    targetAdminId: string,
    status: 'active' | 'suspended',
    reason?: string,
    ip?: string,
    userAgent?: string
  ) {
    if (actorAdminId === targetAdminId && status === 'suspended') {
      throw new Error('Administrators cannot deactivate their own account.');
    }

    const pool = getPool();
    let prevStatus = 'unknown';

    if (pool) {
      const rows = await query<any>(
        `SELECT id, email, status FROM users WHERE id = $1 AND LOWER(role) = 'admin'`,
        [targetAdminId]
      );
      if (rows.length === 0) {
        throw new Error('Staff administrator account not found');
      }
      prevStatus = rows[0].status;

      // Ensure at least one active admin remains in the system
      if (status === 'suspended') {
        const activeCountRows = await query<any>(
          `SELECT COUNT(*)::int as count FROM users WHERE LOWER(role) = 'admin' AND status = 'active'`
        );
        const count = activeCountRows[0]?.count || 0;
        if (count <= 1 && prevStatus === 'active') {
          throw new Error('Cannot deactivate the sole remaining active administrator');
        }
      }

      await query(`UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 AND LOWER(role) = 'admin'`, [
        status,
        targetAdminId,
      ]);
    } else {
      const target = Array.from(inMemoryDb.users.values()).find(
        (u) => u.id === targetAdminId && (u.role || '').toLowerCase() === 'admin'
      );
      if (!target) {
        throw new Error('Staff administrator account not found');
      }
      prevStatus = target.status;

      if (status === 'suspended') {
        const activeCount = Array.from(inMemoryDb.users.values()).filter(
          (u) => (u.role || '').toLowerCase() === 'admin' && u.status === 'active'
        ).length;
        if (activeCount <= 1 && prevStatus === 'active') {
          throw new Error('Cannot deactivate the sole remaining active administrator');
        }
      }

      target.status = status;
      target.updated_at = new Date();
    }

    await this.recordAuditLog(
      actorAdminId,
      status === 'suspended' ? 'STAFF_ADMIN_DEACTIVATED' : 'STAFF_ADMIN_ACTIVATED',
      'user',
      targetAdminId,
      {
        previous_status: prevStatus,
        new_status: status,
        reason: reason || 'Administrative governance decision',
        performed_by: actorAdminId,
      },
      ip,
      userAgent
    );

    return {
      success: true,
      targetAdminId,
      status,
      previousStatus: prevStatus,
    };
  }
}
