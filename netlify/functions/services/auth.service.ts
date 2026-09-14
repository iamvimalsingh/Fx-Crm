import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { inMemoryDb, getPool, query, UserRecord, PasswordResetRecord, AuditLogRecord, DatabaseGuard } from '../db/client';
import { generateToken } from '../middleware/auth';
import { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput } from '../middleware/validation';
import { MailService } from './mail.service';

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
}
