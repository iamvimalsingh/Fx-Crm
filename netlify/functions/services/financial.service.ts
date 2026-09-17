import crypto from 'crypto';
import {
  getPool,
  query,
  inMemoryDb,
  WalletRecord,
  PaymentMethodRecord,
  DepositRecord,
  WithdrawalRecord,
  TransactionRecord,
  AuditLogRecord,
  AccountTransferRecord,
} from '../db/client';
import { NotificationService } from './notification.service';
import { TradingAccountService } from './trading-account.service';
import {
  toDecimal,
  formatMoney,
  calculateAvailableBalance,
  canWithdraw,
  canDeposit,
  Decimal,
} from './financial-math';
import {
  CreateDepositInput,
  ApproveDepositInput,
  RejectDepositInput,
  CreateWithdrawalInput,
  ApproveWithdrawalInput,
  RejectWithdrawalInput,
  ManualAdjustmentInput,
  CreateAccountTransferInput,
  ApproveAccountTransferInput,
  RejectAccountTransferInput,
} from '../middleware/validation';

export interface WalletWithAvailable extends WalletRecord {
  available_balance: string;
}

export class FinancialService {
  /**
   * Generates readable financial reference identifiers (e.g. DEP-2026-X8F2B, TRF-2026-A1B2C)
   */
  private static generateReference(prefix: 'DEP' | 'WTH' | 'TXN' | 'TRF'): string {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    return `${prefix}-${timestamp}-${randomHex}`;
  }

  /**
   * Records a security / administrative audit log entry
   */
  public static async recordAuditLog(
    actorId: string | null,
    action: string,
    targetType: string,
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
        [auditId, actorId, action, targetType, targetId, JSON.stringify(details), sanitizedIp, sanitizedUserAgent, now]
      );
    } else {
      const record: AuditLogRecord = {
        id: auditId,
        actor_id: actorId,
        action,
        entity_type: targetType,
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
   * Retrieves or provisions the user's primary wallet for a currency (default USD).
   * Exact Decimal arithmetic computes available_balance = balance - reserved_balance.
   */
  public static async getOrCreateWallet(userId: string, currency = 'USD'): Promise<WalletWithAvailable> {
    const pool = getPool();
    const upperCurrency = currency.toUpperCase();

    if (pool) {
      let rows = await query<WalletRecord>(
        'SELECT * FROM wallets WHERE user_id = $1 AND currency = $2',
        [userId, upperCurrency]
      );

      if (rows.length === 0) {
        const newWalletId = crypto.randomUUID();
        const now = new Date();
        await query(
          `INSERT INTO wallets (id, user_id, currency, balance, reserved_balance, created_at, updated_at)
           VALUES ($1, $2, $3, 0.00, 0.00, $4, $5)`,
          [newWalletId, userId, upperCurrency, now, now]
        );
        rows = await query<WalletRecord>('SELECT * FROM wallets WHERE id = $1', [newWalletId]);
      }

      const w = rows[0];
      const avail = calculateAvailableBalance(w.balance, w.reserved_balance);
      return {
        ...w,
        balance: formatMoney(w.balance),
        reserved_balance: formatMoney(w.reserved_balance),
        available_balance: formatMoney(avail),
      };
    } else {
      const key = `${userId}_${upperCurrency}`;
      let wallet = inMemoryDb.wallets.get(key);

      if (!wallet) {
        // Search by user_id if key mismatch
        for (const w of inMemoryDb.wallets.values()) {
          if (w.user_id === userId && w.currency === upperCurrency) {
            wallet = w;
            break;
          }
        }
      }

      if (!wallet) {
        wallet = {
          id: crypto.randomUUID(),
          user_id: userId,
          currency: upperCurrency,
          balance: '0.00',
          reserved_balance: '0.00',
          created_at: new Date(),
          updated_at: new Date(),
        };
        inMemoryDb.wallets.set(wallet.id, wallet);
        inMemoryDb.wallets.set(key, wallet);
      }

      const avail = calculateAvailableBalance(wallet.balance, wallet.reserved_balance);
      return {
        ...wallet,
        balance: formatMoney(wallet.balance),
        reserved_balance: formatMoney(wallet.reserved_balance),
        available_balance: formatMoney(avail),
      };
    }
  }

  /**
   * Retrieves active payment methods for manual deposits/withdrawals
   */
  public static async getPaymentMethods(type?: 'deposit' | 'withdrawal'): Promise<PaymentMethodRecord[]> {
    const pool = getPool();
    if (pool) {
      if (type) {
        return query<PaymentMethodRecord>(
          'SELECT * FROM payment_methods WHERE is_active = true AND (type = $1 OR type = $2) ORDER BY name ASC',
          [type, 'both']
        );
      }
      return query<PaymentMethodRecord>(
        'SELECT * FROM payment_methods WHERE is_active = true ORDER BY name ASC'
      );
    } else {
      const all = Array.from(inMemoryDb.paymentMethods.values()).filter((p) => p.is_active);
      if (type) {
        return all.filter((p) => p.type === type || p.type === 'both');
      }
      return all;
    }
  }

  /**
   * CLIENT: Creates a new pending Deposit request.
   * Does NOT alter wallet balance until reviewed and approved by an Admin.
   */
  public static async createDeposit(
    userId: string,
    input: CreateDepositInput,
    ip?: string,
    userAgent?: string
  ): Promise<DepositRecord> {
    const wallet = await this.getOrCreateWallet(userId, input.currency || 'USD');
    const depositAmount = toDecimal(input.amount);

    let paymentMethodName = input.payment_method_name?.trim() || 'Manual / Other';
    const isManualOrOther =
      !input.payment_method_id ||
      input.payment_method_id === 'manual_other' ||
      input.payment_method_id === 'custom_manual';

    if (!isManualOrOther && input.payment_method_id) {
      const pms = await this.getPaymentMethods('deposit');
      const found = pms.find((p) => p.id === input.payment_method_id);
      if (found) {
        paymentMethodName = found.name;
        const validation = canDeposit(depositAmount, found.min_amount, found.max_amount);
        if (!validation.valid) {
          throw new Error(validation.reason);
        }
      } else {
        const validation = canDeposit(depositAmount);
        if (!validation.valid) {
          throw new Error(validation.reason);
        }
      }
    } else {
      if (input.payment_method_name?.trim()) {
        paymentMethodName = input.payment_method_name.trim();
      }
      const validation = canDeposit(depositAmount);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }
    }

    const pool = getPool();
    const depositId = crypto.randomUUID();
    const referenceNo = this.generateReference('DEP');
    const now = new Date();
    const amountStr = formatMoney(depositAmount);

    const depositRecord: DepositRecord = {
      id: depositId,
      reference_no: referenceNo,
      user_id: userId,
      wallet_id: wallet.id,
      payment_method_id: isManualOrOther ? null : (input.payment_method_id || null),
      payment_method_name: paymentMethodName,
      amount: amountStr,
      currency: wallet.currency,
      status: 'pending',
      proof_file_path: input.proof_file_path || null,
      client_notes: input.client_notes || null,
      admin_notes: null,
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      created_at: now,
      updated_at: now,
    };

    if (pool) {
      await query(
        `INSERT INTO deposits (id, reference_no, user_id, wallet_id, payment_method_id, payment_method_name, amount, currency, status, proof_file_path, client_notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          depositRecord.id,
          depositRecord.reference_no,
          depositRecord.user_id,
          depositRecord.wallet_id,
          depositRecord.payment_method_id,
          depositRecord.payment_method_name,
          depositRecord.amount,
          depositRecord.currency,
          depositRecord.status,
          depositRecord.proof_file_path,
          depositRecord.client_notes,
          depositRecord.created_at,
          depositRecord.updated_at,
        ]
      );
    } else {
      inMemoryDb.deposits.set(depositRecord.id, depositRecord);
    }

    await this.recordAuditLog(
      userId,
      'DEPOSIT_SUBMITTED',
      'deposit',
      depositId,
      {
        reference_no: referenceNo,
        amount: amountStr,
        currency: wallet.currency,
        payment_method: paymentMethodName,
      },
      ip,
      userAgent
    );

    return depositRecord;
  }

  /**
   * ADMIN: Approves a pending deposit.
   * Atomically:
   * 1. Transitions deposit status to 'approved'
   * 2. Credits wallet balance via exact Decimal addition
   * 3. Creates an immutable ledger entry with balance_before and balance_after
   * 4. Logs audit entry
   */
  public static async approveDeposit(
    depositId: string,
    adminId: string,
    input: ApproveDepositInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ deposit: DepositRecord; transaction: TransactionRecord; wallet: WalletWithAvailable }> {
    const pool = getPool();
    let deposit: DepositRecord | null = null;

    if (pool) {
      const rows = await query<DepositRecord>('SELECT * FROM deposits WHERE id = $1', [depositId]);
      deposit = rows[0] || null;
    } else {
      deposit = inMemoryDb.deposits.get(depositId) || null;
    }

    if (!deposit) {
      throw new Error(`Deposit request "${depositId}" not found`);
    }

    if (deposit.status !== 'pending') {
      throw new Error(`Cannot approve deposit in "${deposit.status}" status. Only pending deposits can be approved.`);
    }

    const wallet = await this.getOrCreateWallet(deposit.user_id, deposit.currency);

    // Exact financial math
    const balanceBeforeDec = toDecimal(wallet.balance);
    const depositAmountDec = toDecimal(deposit.amount);
    const balanceAfterDec = balanceBeforeDec.plus(depositAmountDec);
    const reservedDec = toDecimal(wallet.reserved_balance);

    const balanceBeforeStr = formatMoney(balanceBeforeDec);
    const balanceAfterStr = formatMoney(balanceAfterDec);
    const reservedStr = formatMoney(reservedDec);

    const now = new Date();
    const txnNo = this.generateReference('TXN');
    const txnId = crypto.randomUUID();

    const transactionRecord: TransactionRecord = {
      id: txnId,
      transaction_no: txnNo,
      user_id: deposit.user_id,
      wallet_id: wallet.id,
      type: 'deposit',
      amount: formatMoney(depositAmountDec),
      currency: deposit.currency,
      balance_before: balanceBeforeStr,
      balance_after: balanceAfterStr,
      reserved_before: reservedStr,
      reserved_after: reservedStr,
      status: 'completed',
      reference_type: 'deposit',
      reference_id: deposit.id,
      description: `Manual Deposit approved via ${deposit.payment_method_name} [Ref: ${deposit.reference_no}]`,
      created_at: now,
    };

    if (pool) {
      // Execute in PostgreSQL
      await query(
        `UPDATE deposits 
         SET status = 'approved', approved_by = $1, approved_at = $2, admin_notes = $3, updated_at = $4
         WHERE id = $5`,
        [adminId, now, input.admin_notes || null, now, deposit.id]
      );

      await query(
        `UPDATE wallets 
         SET balance = $1, updated_at = $2
         WHERE id = $3`,
        [balanceAfterStr, now, wallet.id]
      );

      await query(
        `INSERT INTO transactions (id, transaction_no, user_id, wallet_id, type, amount, currency, balance_before, balance_after, reserved_before, reserved_after, status, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          transactionRecord.id,
          transactionRecord.transaction_no,
          transactionRecord.user_id,
          transactionRecord.wallet_id,
          transactionRecord.type,
          transactionRecord.amount,
          transactionRecord.currency,
          transactionRecord.balance_before,
          transactionRecord.balance_after,
          transactionRecord.reserved_before,
          transactionRecord.reserved_after,
          transactionRecord.status,
          transactionRecord.reference_type,
          transactionRecord.reference_id,
          transactionRecord.description,
          transactionRecord.created_at,
        ]
      );
    } else {
      // In-Memory state update
      deposit.status = 'approved';
      deposit.approved_by = adminId;
      deposit.approved_at = now;
      deposit.admin_notes = input.admin_notes || null;
      deposit.updated_at = now;

      wallet.balance = balanceAfterStr;
      wallet.updated_at = now;
      inMemoryDb.wallets.set(wallet.id, wallet);
      inMemoryDb.wallets.set(`${wallet.user_id}_${wallet.currency}`, wallet);

      inMemoryDb.transactions.unshift(transactionRecord);
    }

    await this.recordAuditLog(
      adminId,
      'DEPOSIT_APPROVED',
      'deposit',
      deposit.id,
      {
        reference_no: deposit.reference_no,
        amount: deposit.amount,
        currency: deposit.currency,
        balance_before: balanceBeforeStr,
        balance_after: balanceAfterStr,
        admin_notes: input.admin_notes || null,
      },
      ip,
      userAgent
    );

    await NotificationService.createNotification(
      deposit.user_id,
      'Deposit Approved',
      `Your deposit of $${deposit.amount} ${deposit.currency} (${deposit.reference_no}) has been approved and credited.`,
      'deposit_status',
      { deposit_id: deposit.id, reference_no: deposit.reference_no, amount: deposit.amount, currency: deposit.currency }
    );

    const updatedWallet = await this.getOrCreateWallet(deposit.user_id, deposit.currency);

    return {
      deposit,
      transaction: transactionRecord,
      wallet: updatedWallet,
    };
  }

  /**
   * ADMIN: Rejects a pending deposit with justification reason.
   */
  public static async rejectDeposit(
    depositId: string,
    adminId: string,
    input: RejectDepositInput,
    ip?: string,
    userAgent?: string
  ): Promise<DepositRecord> {
    const pool = getPool();
    let deposit: DepositRecord | null = null;

    if (pool) {
      const rows = await query<DepositRecord>('SELECT * FROM deposits WHERE id = $1', [depositId]);
      deposit = rows[0] || null;
    } else {
      deposit = inMemoryDb.deposits.get(depositId) || null;
    }

    if (!deposit) {
      throw new Error(`Deposit request "${depositId}" not found`);
    }

    if (deposit.status !== 'pending') {
      throw new Error(`Cannot reject deposit in "${deposit.status}" status. Only pending deposits can be rejected.`);
    }

    const now = new Date();

    if (pool) {
      await query(
        `UPDATE deposits 
         SET status = 'rejected', rejected_by = $1, rejected_at = $2, rejection_reason = $3, admin_notes = $4, updated_at = $5
         WHERE id = $6`,
        [adminId, now, input.rejection_reason, input.admin_notes || null, now, deposit.id]
      );
    } else {
      deposit.status = 'rejected';
      deposit.rejected_by = adminId;
      deposit.rejected_at = now;
      deposit.rejection_reason = input.rejection_reason;
      deposit.admin_notes = input.admin_notes || null;
      deposit.updated_at = now;
    }

    await this.recordAuditLog(
      adminId,
      'DEPOSIT_REJECTED',
      'deposit',
      deposit.id,
      {
        reference_no: deposit.reference_no,
        amount: deposit.amount,
        rejection_reason: input.rejection_reason,
        admin_notes: input.admin_notes || null,
      },
      ip,
      userAgent
    );

    await NotificationService.createNotification(
      deposit.user_id,
      'Deposit Rejected',
      `Your deposit request (${deposit.reference_no}) of $${deposit.amount} ${deposit.currency} was rejected. Reason: ${input.rejection_reason}`,
      'deposit_status',
      { deposit_id: deposit.id, reference_no: deposit.reference_no, rejection_reason: input.rejection_reason }
    );

    return deposit;
  }

  /**
   * CLIENT: Creates a new pending Withdrawal request.
   * Atomically reserves funds:
   * 1. Validates available balance >= requested amount
   * 2. Increases reserved_balance by requested amount
   * 3. Inserts an immutable ledger transaction of type 'withdrawal_reserve'
   * 4. Logs audit entry
   */
  public static async createWithdrawal(
    userId: string,
    input: CreateWithdrawalInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ withdrawal: WithdrawalRecord; wallet: WalletWithAvailable; transaction: TransactionRecord }> {
    const wallet = await this.getOrCreateWallet(userId, input.currency || 'USD');
    const withdrawalAmount = toDecimal(input.amount);

    let paymentMethodName = 'Manual Bank / Crypto Clearing';
    let minLimit = '10.00';
    let maxLimit = '50000.00';

    if (input.payment_method_id) {
      const pms = await this.getPaymentMethods('withdrawal');
      const found = pms.find((p) => p.id === input.payment_method_id);
      if (found) {
        paymentMethodName = found.name;
        minLimit = found.min_amount;
        maxLimit = found.max_amount;
      }
    }

    const validation = canWithdraw(wallet.available_balance, withdrawalAmount, minLimit, maxLimit);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    // Exact financial reserve calculation
    const balanceDec = toDecimal(wallet.balance);
    const reservedBeforeDec = toDecimal(wallet.reserved_balance);
    const reservedAfterDec = reservedBeforeDec.plus(withdrawalAmount);

    const balanceStr = formatMoney(balanceDec);
    const reservedBeforeStr = formatMoney(reservedBeforeDec);
    const reservedAfterStr = formatMoney(reservedAfterDec);
    const amountStr = formatMoney(withdrawalAmount);

    const pool = getPool();
    const withdrawalId = crypto.randomUUID();
    const referenceNo = this.generateReference('WTH');
    const now = new Date();

    const withdrawalRecord: WithdrawalRecord = {
      id: withdrawalId,
      reference_no: referenceNo,
      user_id: userId,
      wallet_id: wallet.id,
      payment_method_id: input.payment_method_id || null,
      payment_method_name: paymentMethodName,
      amount: amountStr,
      currency: wallet.currency,
      status: 'pending',
      payout_details: input.payout_details,
      client_notes: input.client_notes || null,
      admin_notes: null,
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      created_at: now,
      updated_at: now,
    };

    const txnNo = this.generateReference('TXN');
    const txnId = crypto.randomUUID();

    const transactionRecord: TransactionRecord = {
      id: txnId,
      transaction_no: txnNo,
      user_id: userId,
      wallet_id: wallet.id,
      type: 'withdrawal_reserve',
      amount: amountStr,
      currency: wallet.currency,
      balance_before: balanceStr,
      balance_after: balanceStr,
      reserved_before: reservedBeforeStr,
      reserved_after: reservedAfterStr,
      status: 'completed',
      reference_type: 'withdrawal_reserve',
      reference_id: withdrawalId,
      description: `Funds reserved for manual withdrawal review [Ref: ${referenceNo}]`,
      created_at: now,
    };

    if (pool) {
      await query(
        `INSERT INTO withdrawals (id, reference_no, user_id, wallet_id, payment_method_id, payment_method_name, amount, currency, status, payout_details, client_notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          withdrawalRecord.id,
          withdrawalRecord.reference_no,
          withdrawalRecord.user_id,
          withdrawalRecord.wallet_id,
          withdrawalRecord.payment_method_id,
          withdrawalRecord.payment_method_name,
          withdrawalRecord.amount,
          withdrawalRecord.currency,
          withdrawalRecord.status,
          JSON.stringify(withdrawalRecord.payout_details),
          withdrawalRecord.client_notes,
          withdrawalRecord.created_at,
          withdrawalRecord.updated_at,
        ]
      );

      await query(
        `UPDATE wallets
         SET reserved_balance = $1, updated_at = $2
         WHERE id = $3`,
        [reservedAfterStr, now, wallet.id]
      );

      await query(
        `INSERT INTO transactions (id, transaction_no, user_id, wallet_id, type, amount, currency, balance_before, balance_after, reserved_before, reserved_after, status, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          transactionRecord.id,
          transactionRecord.transaction_no,
          transactionRecord.user_id,
          transactionRecord.wallet_id,
          transactionRecord.type,
          transactionRecord.amount,
          transactionRecord.currency,
          transactionRecord.balance_before,
          transactionRecord.balance_after,
          transactionRecord.reserved_before,
          transactionRecord.reserved_after,
          transactionRecord.status,
          transactionRecord.reference_type,
          transactionRecord.reference_id,
          transactionRecord.description,
          transactionRecord.created_at,
        ]
      );
    } else {
      inMemoryDb.withdrawals.set(withdrawalRecord.id, withdrawalRecord);
      wallet.reserved_balance = reservedAfterStr;
      wallet.updated_at = now;
      inMemoryDb.wallets.set(wallet.id, wallet);
      inMemoryDb.wallets.set(`${wallet.user_id}_${wallet.currency}`, wallet);
      inMemoryDb.transactions.unshift(transactionRecord);
    }

    await this.recordAuditLog(
      userId,
      'WITHDRAWAL_REQUESTED',
      'withdrawal',
      withdrawalId,
      {
        reference_no: referenceNo,
        amount: amountStr,
        currency: wallet.currency,
        reserved_before: reservedBeforeStr,
        reserved_after: reservedAfterStr,
        payout_details: input.payout_details,
      },
      ip,
      userAgent
    );

    const updatedWallet = await this.getOrCreateWallet(userId, wallet.currency);

    return {
      withdrawal: withdrawalRecord,
      wallet: updatedWallet,
      transaction: transactionRecord,
    };
  }

  /**
   * ADMIN: Approves a pending withdrawal.
   * Atomically:
   * 1. Deducts amount from balance and reserved_balance
   * 2. Transitions withdrawal status to 'approved'
   * 3. Creates ledger transaction with type 'withdrawal'
   * 4. Logs audit entry
   */
  public static async approveWithdrawal(
    withdrawalId: string,
    adminId: string,
    input: ApproveWithdrawalInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ withdrawal: WithdrawalRecord; transaction: TransactionRecord; wallet: WalletWithAvailable }> {
    const pool = getPool();
    let withdrawal: WithdrawalRecord | null = null;

    if (pool) {
      const rows = await query<WithdrawalRecord>('SELECT * FROM withdrawals WHERE id = $1', [withdrawalId]);
      withdrawal = rows[0] || null;
    } else {
      withdrawal = inMemoryDb.withdrawals.get(withdrawalId) || null;
    }

    if (!withdrawal) {
      throw new Error(`Withdrawal request "${withdrawalId}" not found`);
    }

    if (withdrawal.status !== 'pending') {
      throw new Error(
        `Cannot approve withdrawal in "${withdrawal.status}" status. Only pending requests can be approved.`
      );
    }

    const wallet = await this.getOrCreateWallet(withdrawal.user_id, withdrawal.currency);

    // Exact financial deduction math
    const balanceBeforeDec = toDecimal(wallet.balance);
    const reservedBeforeDec = toDecimal(wallet.reserved_balance);
    const amountDec = toDecimal(withdrawal.amount);

    if (reservedBeforeDec.lessThan(amountDec)) {
      throw new Error(
        `Invariant violation: Reserved balance ($${reservedBeforeDec.toFixed(2)}) is less than withdrawal amount ($${amountDec.toFixed(2)})`
      );
    }

    const balanceAfterDec = balanceBeforeDec.minus(amountDec);
    const reservedAfterDec = reservedBeforeDec.minus(amountDec);

    const balanceBeforeStr = formatMoney(balanceBeforeDec);
    const balanceAfterStr = formatMoney(balanceAfterDec);
    const reservedBeforeStr = formatMoney(reservedBeforeDec);
    const reservedAfterStr = formatMoney(reservedAfterDec);

    const now = new Date();
    const txnNo = this.generateReference('TXN');
    const txnId = crypto.randomUUID();

    const transactionRecord: TransactionRecord = {
      id: txnId,
      transaction_no: txnNo,
      user_id: withdrawal.user_id,
      wallet_id: wallet.id,
      type: 'withdrawal',
      amount: formatMoney(amountDec),
      currency: withdrawal.currency,
      balance_before: balanceBeforeStr,
      balance_after: balanceAfterStr,
      reserved_before: reservedBeforeStr,
      reserved_after: reservedAfterStr,
      status: 'completed',
      reference_type: 'withdrawal',
      reference_id: withdrawal.id,
      description: `Manual withdrawal dispatched via ${withdrawal.payment_method_name} [Ref: ${withdrawal.reference_no}]`,
      created_at: now,
    };

    if (pool) {
      await query(
        `UPDATE withdrawals
         SET status = 'approved', approved_by = $1, approved_at = $2, admin_notes = $3, updated_at = $4
         WHERE id = $5`,
        [adminId, now, input.admin_notes || null, now, withdrawal.id]
      );

      await query(
        `UPDATE wallets
         SET balance = $1, reserved_balance = $2, updated_at = $3
         WHERE id = $4`,
        [balanceAfterStr, reservedAfterStr, now, wallet.id]
      );

      await query(
        `INSERT INTO transactions (id, transaction_no, user_id, wallet_id, type, amount, currency, balance_before, balance_after, reserved_before, reserved_after, status, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          transactionRecord.id,
          transactionRecord.transaction_no,
          transactionRecord.user_id,
          transactionRecord.wallet_id,
          transactionRecord.type,
          transactionRecord.amount,
          transactionRecord.currency,
          transactionRecord.balance_before,
          transactionRecord.balance_after,
          transactionRecord.reserved_before,
          transactionRecord.reserved_after,
          transactionRecord.status,
          transactionRecord.reference_type,
          transactionRecord.reference_id,
          transactionRecord.description,
          transactionRecord.created_at,
        ]
      );
    } else {
      withdrawal.status = 'approved';
      withdrawal.approved_by = adminId;
      withdrawal.approved_at = now;
      withdrawal.admin_notes = input.admin_notes || null;
      withdrawal.updated_at = now;

      wallet.balance = balanceAfterStr;
      wallet.reserved_balance = reservedAfterStr;
      wallet.updated_at = now;
      inMemoryDb.wallets.set(wallet.id, wallet);
      inMemoryDb.wallets.set(`${wallet.user_id}_${wallet.currency}`, wallet);

      inMemoryDb.transactions.unshift(transactionRecord);
    }

    await this.recordAuditLog(
      adminId,
      'WITHDRAWAL_APPROVED',
      'withdrawal',
      withdrawal.id,
      {
        reference_no: withdrawal.reference_no,
        amount: withdrawal.amount,
        balance_before: balanceBeforeStr,
        balance_after: balanceAfterStr,
        reserved_before: reservedBeforeStr,
        reserved_after: reservedAfterStr,
        admin_notes: input.admin_notes || null,
      },
      ip,
      userAgent
    );

    await NotificationService.createNotification(
      withdrawal.user_id,
      'Withdrawal Approved',
      `Your withdrawal of $${withdrawal.amount} ${withdrawal.currency} (${withdrawal.reference_no}) has been approved and processed.`,
      'withdrawal_status',
      { withdrawal_id: withdrawal.id, reference_no: withdrawal.reference_no, amount: withdrawal.amount, currency: withdrawal.currency }
    );

    const updatedWallet = await this.getOrCreateWallet(withdrawal.user_id, withdrawal.currency);

    return {
      withdrawal,
      transaction: transactionRecord,
      wallet: updatedWallet,
    };
  }

  /**
   * ADMIN: Rejects a pending withdrawal.
   * Atomically:
   * 1. Releases reserved funds back into available pool (reserved_balance -= amount)
   * 2. Transitions withdrawal status to 'rejected'
   * 3. Creates ledger transaction of type 'withdrawal_release'
   * 4. Logs audit entry
   */
  public static async rejectWithdrawal(
    withdrawalId: string,
    adminId: string,
    input: RejectWithdrawalInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ withdrawal: WithdrawalRecord; transaction: TransactionRecord; wallet: WalletWithAvailable }> {
    const pool = getPool();
    let withdrawal: WithdrawalRecord | null = null;

    if (pool) {
      const rows = await query<WithdrawalRecord>('SELECT * FROM withdrawals WHERE id = $1', [withdrawalId]);
      withdrawal = rows[0] || null;
    } else {
      withdrawal = inMemoryDb.withdrawals.get(withdrawalId) || null;
    }

    if (!withdrawal) {
      throw new Error(`Withdrawal request "${withdrawalId}" not found`);
    }

    if (withdrawal.status !== 'pending') {
      throw new Error(`Cannot reject withdrawal in "${withdrawal.status}" status. Only pending requests can be rejected.`);
    }

    const wallet = await this.getOrCreateWallet(withdrawal.user_id, withdrawal.currency);

    // Exact financial release math
    const balanceDec = toDecimal(wallet.balance);
    const reservedBeforeDec = toDecimal(wallet.reserved_balance);
    const amountDec = toDecimal(withdrawal.amount);

    const reservedAfterDec = Decimal.max(0, reservedBeforeDec.minus(amountDec));

    const balanceStr = formatMoney(balanceDec);
    const reservedBeforeStr = formatMoney(reservedBeforeDec);
    const reservedAfterStr = formatMoney(reservedAfterDec);

    const now = new Date();
    const txnNo = this.generateReference('TXN');
    const txnId = crypto.randomUUID();

    const transactionRecord: TransactionRecord = {
      id: txnId,
      transaction_no: txnNo,
      user_id: withdrawal.user_id,
      wallet_id: wallet.id,
      type: 'withdrawal_release',
      amount: formatMoney(amountDec),
      currency: withdrawal.currency,
      balance_before: balanceStr,
      balance_after: balanceStr,
      reserved_before: reservedBeforeStr,
      reserved_after: reservedAfterStr,
      status: 'completed',
      reference_type: 'withdrawal_release',
      reference_id: withdrawal.id,
      description: `Reserved funds released due to withdrawal rejection: ${input.rejection_reason} [Ref: ${withdrawal.reference_no}]`,
      created_at: now,
    };

    if (pool) {
      await query(
        `UPDATE withdrawals
         SET status = 'rejected', rejected_by = $1, rejected_at = $2, rejection_reason = $3, admin_notes = $4, updated_at = $5
         WHERE id = $6`,
        [adminId, now, input.rejection_reason, input.admin_notes || null, now, withdrawal.id]
      );

      await query(
        `UPDATE wallets
         SET reserved_balance = $1, updated_at = $2
         WHERE id = $3`,
        [reservedAfterStr, now, wallet.id]
      );

      await query(
        `INSERT INTO transactions (id, transaction_no, user_id, wallet_id, type, amount, currency, balance_before, balance_after, reserved_before, reserved_after, status, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          transactionRecord.id,
          transactionRecord.transaction_no,
          transactionRecord.user_id,
          transactionRecord.wallet_id,
          transactionRecord.type,
          transactionRecord.amount,
          transactionRecord.currency,
          transactionRecord.balance_before,
          transactionRecord.balance_after,
          transactionRecord.reserved_before,
          transactionRecord.reserved_after,
          transactionRecord.status,
          transactionRecord.reference_type,
          transactionRecord.reference_id,
          transactionRecord.description,
          transactionRecord.created_at,
        ]
      );
    } else {
      withdrawal.status = 'rejected';
      withdrawal.rejected_by = adminId;
      withdrawal.rejected_at = now;
      withdrawal.rejection_reason = input.rejection_reason;
      withdrawal.admin_notes = input.admin_notes || null;
      withdrawal.updated_at = now;

      wallet.reserved_balance = reservedAfterStr;
      wallet.updated_at = now;
      inMemoryDb.wallets.set(wallet.id, wallet);
      inMemoryDb.wallets.set(`${wallet.user_id}_${wallet.currency}`, wallet);

      inMemoryDb.transactions.unshift(transactionRecord);
    }

    await this.recordAuditLog(
      adminId,
      'WITHDRAWAL_REJECTED',
      'withdrawal',
      withdrawal.id,
      {
        reference_no: withdrawal.reference_no,
        amount: withdrawal.amount,
        rejection_reason: input.rejection_reason,
        admin_notes: input.admin_notes || null,
        reserved_before: reservedBeforeStr,
        reserved_after: reservedAfterStr,
      },
      ip,
      userAgent
    );

    await NotificationService.createNotification(
      withdrawal.user_id,
      'Withdrawal Rejected',
      `Your withdrawal request (${withdrawal.reference_no}) was rejected and reserved funds returned. Reason: ${input.rejection_reason}`,
      'withdrawal_status',
      { withdrawal_id: withdrawal.id, reference_no: withdrawal.reference_no, rejection_reason: input.rejection_reason }
    );

    const updatedWallet = await this.getOrCreateWallet(withdrawal.user_id, withdrawal.currency);

    return {
      withdrawal,
      transaction: transactionRecord,
      wallet: updatedWallet,
    };
  }

  /**
   * CLIENT or ADMIN: Cancels a pending withdrawal before execution.
   * Releases reserved balance and records ledger transaction.
   */
  public static async cancelWithdrawal(
    withdrawalId: string,
    actorId: string,
    isAdmin = false,
    ip?: string,
    userAgent?: string
  ): Promise<{ withdrawal: WithdrawalRecord; wallet: WalletWithAvailable }> {
    const pool = getPool();
    let withdrawal: WithdrawalRecord | null = null;

    if (pool) {
      const rows = await query<WithdrawalRecord>('SELECT * FROM withdrawals WHERE id = $1', [withdrawalId]);
      withdrawal = rows[0] || null;
    } else {
      withdrawal = inMemoryDb.withdrawals.get(withdrawalId) || null;
    }

    if (!withdrawal) {
      throw new Error(`Withdrawal request "${withdrawalId}" not found`);
    }

    // Client can only cancel their own request
    if (!isAdmin && withdrawal.user_id !== actorId) {
      throw new Error('Access denied: You can only cancel your own withdrawal requests');
    }

    if (withdrawal.status !== 'pending') {
      throw new Error(`Cannot cancel withdrawal in "${withdrawal.status}" status. Only pending requests can be cancelled.`);
    }

    const wallet = await this.getOrCreateWallet(withdrawal.user_id, withdrawal.currency);

    // Exact financial release math
    const balanceDec = toDecimal(wallet.balance);
    const reservedBeforeDec = toDecimal(wallet.reserved_balance);
    const amountDec = toDecimal(withdrawal.amount);
    const reservedAfterDec = Decimal.max(0, reservedBeforeDec.minus(amountDec));

    const balanceStr = formatMoney(balanceDec);
    const reservedBeforeStr = formatMoney(reservedBeforeDec);
    const reservedAfterStr = formatMoney(reservedAfterDec);

    const now = new Date();
    const txnNo = this.generateReference('TXN');
    const txnId = crypto.randomUUID();

    const transactionRecord: TransactionRecord = {
      id: txnId,
      transaction_no: txnNo,
      user_id: withdrawal.user_id,
      wallet_id: wallet.id,
      type: 'withdrawal_release',
      amount: formatMoney(amountDec),
      currency: withdrawal.currency,
      balance_before: balanceStr,
      balance_after: balanceStr,
      reserved_before: reservedBeforeStr,
      reserved_after: reservedAfterStr,
      status: 'completed',
      reference_type: 'withdrawal_cancel',
      reference_id: withdrawal.id,
      description: `Reserved funds released: Withdrawal cancelled by ${isAdmin ? 'Administrator' : 'Client'} [Ref: ${withdrawal.reference_no}]`,
      created_at: now,
    };

    if (pool) {
      await query(
        `UPDATE withdrawals
         SET status = 'cancelled', admin_notes = $1, updated_at = $2
         WHERE id = $3`,
        [`Cancelled by ${isAdmin ? 'admin' : 'user'}`, now, withdrawal.id]
      );

      await query(
        `UPDATE wallets
         SET reserved_balance = $1, updated_at = $2
         WHERE id = $3`,
        [reservedAfterStr, now, wallet.id]
      );

      await query(
        `INSERT INTO transactions (id, transaction_no, user_id, wallet_id, type, amount, currency, balance_before, balance_after, reserved_before, reserved_after, status, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          transactionRecord.id,
          transactionRecord.transaction_no,
          transactionRecord.user_id,
          transactionRecord.wallet_id,
          transactionRecord.type,
          transactionRecord.amount,
          transactionRecord.currency,
          transactionRecord.balance_before,
          transactionRecord.balance_after,
          transactionRecord.reserved_before,
          transactionRecord.reserved_after,
          transactionRecord.status,
          transactionRecord.reference_type,
          transactionRecord.reference_id,
          transactionRecord.description,
          transactionRecord.created_at,
        ]
      );
    } else {
      withdrawal.status = 'cancelled';
      withdrawal.admin_notes = `Cancelled by ${isAdmin ? 'admin' : 'user'}`;
      withdrawal.updated_at = now;

      wallet.reserved_balance = reservedAfterStr;
      wallet.updated_at = now;
      inMemoryDb.wallets.set(wallet.id, wallet);
      inMemoryDb.wallets.set(`${wallet.user_id}_${wallet.currency}`, wallet);

      inMemoryDb.transactions.unshift(transactionRecord);
    }

    await this.recordAuditLog(
      actorId,
      'WITHDRAWAL_CANCELLED',
      'withdrawal',
      withdrawal.id,
      {
        reference_no: withdrawal.reference_no,
        amount: withdrawal.amount,
        cancelled_by_admin: isAdmin,
      },
      ip,
      userAgent
    );

    const updatedWallet = await this.getOrCreateWallet(withdrawal.user_id, withdrawal.currency);

    return {
      withdrawal,
      wallet: updatedWallet,
    };
  }

  /**
   * ADMIN: Manual balance adjustment (Credit or Debit)
   * Ensures exact decimal calculations, checks for negative balance invariants,
   * creates immutable ledger entry, and records detailed audit log.
   */
  public static async manualAdjustment(
    adminId: string,
    input: ManualAdjustmentInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ transaction: TransactionRecord; wallet: WalletWithAvailable }> {
    const wallet = await this.getOrCreateWallet(input.user_id, 'USD');
    const adjustAmountDec = toDecimal(input.amount);

    if (adjustAmountDec.lessThanOrEqualTo(0)) {
      throw new Error('Adjustment amount must be greater than zero');
    }

    const balanceBeforeDec = toDecimal(wallet.balance);
    const reservedDec = toDecimal(wallet.reserved_balance);
    let balanceAfterDec: Decimal;

    if (input.type === 'adjustment_credit') {
      balanceAfterDec = balanceBeforeDec.plus(adjustAmountDec);
    } else {
      balanceAfterDec = balanceBeforeDec.minus(adjustAmountDec);
      if (balanceAfterDec.lessThan(reservedDec)) {
        throw new Error(
          `Cannot debit $${adjustAmountDec.toFixed(2)}. Resulting balance ($${balanceAfterDec.toFixed(2)}) would violate reserved balance threshold ($${reservedDec.toFixed(2)})`
        );
      }
    }

    const balanceBeforeStr = formatMoney(balanceBeforeDec);
    const balanceAfterStr = formatMoney(balanceAfterDec);
    const reservedStr = formatMoney(reservedDec);

    const now = new Date();
    const txnNo = this.generateReference('TXN');
    const txnId = crypto.randomUUID();

    const transactionRecord: TransactionRecord = {
      id: txnId,
      transaction_no: txnNo,
      user_id: input.user_id,
      wallet_id: wallet.id,
      type: input.type,
      amount: formatMoney(adjustAmountDec),
      currency: wallet.currency,
      balance_before: balanceBeforeStr,
      balance_after: balanceAfterStr,
      reserved_before: reservedStr,
      reserved_after: reservedStr,
      status: 'completed',
      reference_type: 'manual_adjustment',
      reference_id: adminId,
      description: input.description,
      created_at: now,
    };

    const pool = getPool();

    if (pool) {
      await query(
        `UPDATE wallets
         SET balance = $1, updated_at = $2
         WHERE id = $3`,
        [balanceAfterStr, now, wallet.id]
      );

      await query(
        `INSERT INTO transactions (id, transaction_no, user_id, wallet_id, type, amount, currency, balance_before, balance_after, reserved_before, reserved_after, status, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          transactionRecord.id,
          transactionRecord.transaction_no,
          transactionRecord.user_id,
          transactionRecord.wallet_id,
          transactionRecord.type,
          transactionRecord.amount,
          transactionRecord.currency,
          transactionRecord.balance_before,
          transactionRecord.balance_after,
          transactionRecord.reserved_before,
          transactionRecord.reserved_after,
          transactionRecord.status,
          transactionRecord.reference_type,
          transactionRecord.reference_id,
          transactionRecord.description,
          transactionRecord.created_at,
        ]
      );
    } else {
      wallet.balance = balanceAfterStr;
      wallet.updated_at = now;
      inMemoryDb.wallets.set(wallet.id, wallet);
      inMemoryDb.wallets.set(`${wallet.user_id}_${wallet.currency}`, wallet);

      inMemoryDb.transactions.unshift(transactionRecord);
    }

    await this.recordAuditLog(
      adminId,
      'MANUAL_ADJUSTMENT_EXECUTED',
      'wallet',
      wallet.id,
      {
        target_user_id: input.user_id,
        adjustment_type: input.type,
        amount: formatMoney(adjustAmountDec),
        balance_before: balanceBeforeStr,
        balance_after: balanceAfterStr,
        description: input.description,
      },
      ip,
      userAgent
    );

    const updatedWallet = await this.getOrCreateWallet(input.user_id, wallet.currency);

    return {
      transaction: transactionRecord,
      wallet: updatedWallet,
    };
  }

  /**
   * Queries deposits with optional filters (userId, status)
   */
  public static async listDeposits(filter: {
    userId?: string;
    status?: string;
    limit?: number;
  }): Promise<DepositRecord[]> {
    const pool = getPool();
    const limit = filter.limit || 50;

    if (pool) {
      const conditions: string[] = [];
      const values: any[] = [];

      if (filter.userId) {
        values.push(filter.userId);
        conditions.push(`user_id = $${values.length}`);
      }
      if (filter.status) {
        values.push(filter.status);
        conditions.push(`status = $${values.length}`);
      }

      values.push(limit);
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM deposits ${whereClause} ORDER BY created_at DESC LIMIT $${values.length}`;
      return query<DepositRecord>(sql, values);
    } else {
      let list = Array.from(inMemoryDb.deposits.values());
      if (filter.userId) {
        list = list.filter((d) => d.user_id === filter.userId);
      }
      if (filter.status) {
        list = list.filter((d) => d.status === filter.status);
      }
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return list.slice(0, limit);
    }
  }

  /**
   * Queries withdrawals with optional filters (userId, status)
   */
  public static async listWithdrawals(filter: {
    userId?: string;
    status?: string;
    limit?: number;
  }): Promise<WithdrawalRecord[]> {
    const pool = getPool();
    const limit = filter.limit || 50;

    if (pool) {
      const conditions: string[] = [];
      const values: any[] = [];

      if (filter.userId) {
        values.push(filter.userId);
        conditions.push(`user_id = $${values.length}`);
      }
      if (filter.status) {
        values.push(filter.status);
        conditions.push(`status = $${values.length}`);
      }

      values.push(limit);
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM withdrawals ${whereClause} ORDER BY created_at DESC LIMIT $${values.length}`;
      return query<WithdrawalRecord>(sql, values);
    } else {
      let list = Array.from(inMemoryDb.withdrawals.values());
      if (filter.userId) {
        list = list.filter((w) => w.user_id === filter.userId);
      }
      if (filter.status) {
        list = list.filter((w) => w.status === filter.status);
      }
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return list.slice(0, limit);
    }
  }

  /**
   * Queries immutable transactions/ledger records
   */
  public static async listTransactions(filter: {
    userId?: string;
    type?: string;
    limit?: number;
  }): Promise<TransactionRecord[]> {
    const pool = getPool();
    const limit = filter.limit || 50;

    if (pool) {
      const conditions: string[] = [];
      const values: any[] = [];

      if (filter.userId) {
        values.push(filter.userId);
        conditions.push(`user_id = $${values.length}`);
      }
      if (filter.type) {
        values.push(filter.type);
        conditions.push(`type = $${values.length}`);
      }

      values.push(limit);
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM transactions ${whereClause} ORDER BY created_at DESC LIMIT $${values.length}`;
      return query<TransactionRecord>(sql, values);
    } else {
      let list = [...inMemoryDb.transactions];
      if (filter.userId) {
        list = list.filter((t) => t.user_id === filter.userId);
      }
      if (filter.type) {
        list = list.filter((t) => t.type === filter.type);
      }
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return list.slice(0, limit);
    }
  }

  /**
   * Queries audit logs
   */
  public static async listAuditLogs(filter: {
    targetType?: string;
    targetId?: string;
    limit?: number;
  }): Promise<AuditLogRecord[]> {
    const pool = getPool();
    const limit = filter.limit || 50;

    if (pool) {
      const conditions: string[] = [];
      const values: any[] = [];

      if (filter.targetType) {
        values.push(filter.targetType);
        conditions.push(`entity_type = $${values.length}`);
      }
      if (filter.targetId) {
        values.push(filter.targetId);
        conditions.push(`entity_id = $${values.length}`);
      }

      values.push(limit);
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${values.length}`;
      return query<AuditLogRecord>(sql, values);
    } else {
      let list = [...inMemoryDb.auditLogs];
      if (filter.targetType) {
        list = list.filter((a) => a.entity_type === filter.targetType);
      }
      if (filter.targetId) {
        list = list.filter((a) => a.entity_id === filter.targetId);
      }
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return list.slice(0, limit);
    }
  }

  // =========================================================================
  // ACCOUNT TRANSFERS: WALLET <-> TRADING ACCOUNT WORKFLOW
  // =========================================================================

  /**
   * CLIENT: Creates a new pending transfer request between Client Wallet and Trading Account.
   * Enforces strict IDOR ownership on the trading account and exact decimal validation.
   * In accordance with manual broker architecture, balances are NOT moved until Admin approves.
   */
  public static async createAccountTransfer(
    userId: string,
    input: CreateAccountTransferInput,
    ip?: string,
    userAgent?: string
  ): Promise<AccountTransferRecord> {
    const transferAmount = toDecimal(input.amount);
    if (transferAmount.lessThanOrEqualTo(0)) {
      throw new Error('Transfer amount must be greater than 0.00');
    }

    // 1. Strict IDOR Check: Ensure trading account exists and is owned by this user
    const tradingAccount = await TradingAccountService.getUserAccountById(userId, input.trading_account_id);
    if (!tradingAccount) {
      const err: any = new Error('Trading account not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // 2. Fetch or initialize wallet for this currency
    const currency = input.currency || tradingAccount.currency || 'USD';
    const wallet = await this.getOrCreateWallet(userId, currency);

    // 3. Pre-flight check available balance to provide immediate feedback to client
    if (input.direction === 'wallet_to_trading') {
      const availableDec = toDecimal(wallet.available_balance);
      if (availableDec.lessThan(transferAmount)) {
        throw new Error(
          `Insufficient wallet balance. Available: $${wallet.available_balance} ${wallet.currency}, Requested: $${formatMoney(transferAmount)}`
        );
      }
    } else if (input.direction === 'trading_to_wallet') {
      const tradingBalDec = toDecimal(tradingAccount.balance || '0.00');
      if (tradingBalDec.lessThan(transferAmount)) {
        throw new Error(
          `Insufficient trading account balance. Available: $${tradingAccount.balance || '0.00'} ${tradingAccount.currency}, Requested: $${formatMoney(transferAmount)}`
        );
      }
    } else {
      throw new Error(`Invalid transfer direction: ${input.direction}`);
    }

    const pool = getPool();
    const transferId = crypto.randomUUID();
    const referenceNo = this.generateReference('TRF');
    const now = new Date();
    const amountStr = formatMoney(transferAmount);

    const record: AccountTransferRecord = {
      id: transferId,
      reference_no: referenceNo,
      user_id: userId,
      wallet_id: wallet.id,
      trading_account_id: tradingAccount.id,
      direction: input.direction,
      amount: amountStr,
      currency: wallet.currency,
      status: 'pending',
      client_notes: input.client_notes || null,
      admin_notes: null,
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      created_at: now,
      updated_at: now,
    };

    if (pool) {
      await query(
        `INSERT INTO account_transfers (
          id, reference_no, user_id, wallet_id, trading_account_id, direction, amount, currency, status, client_notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          record.id,
          record.reference_no,
          record.user_id,
          record.wallet_id,
          record.trading_account_id,
          record.direction,
          record.amount,
          record.currency,
          record.status,
          record.client_notes,
          record.created_at,
          record.updated_at,
        ]
      );
    } else {
      inMemoryDb.accountTransfers.set(record.id, record);
    }

    await this.recordAuditLog(
      userId,
      'TRANSFER_REQUEST_CREATED',
      'account_transfer',
      record.id,
      {
        reference_no: record.reference_no,
        direction: record.direction,
        amount: record.amount,
        currency: record.currency,
        trading_account_id: tradingAccount.id,
        account_number: tradingAccount.account_number,
        platform: tradingAccount.platform,
        client_notes: record.client_notes,
      },
      ip,
      userAgent
    );

    return record;
  }

  /**
   * List account transfers with owner and trading account details hydrated
   */
  public static async getAccountTransfers(filter?: {
    userId?: string;
    status?: string;
    tradingAccountId?: string;
  }): Promise<Array<AccountTransferRecord & {
    user_email?: string;
    user_name?: string;
    account_number?: string;
    platform?: string;
  }>> {
    const pool = getPool();
    if (pool) {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.userId) {
        params.push(filter.userId);
        conditions.push(`t.user_id = $${params.length}`);
      }
      if (filter?.status) {
        params.push(filter.status);
        conditions.push(`t.status = $${params.length}`);
      }
      if (filter?.tradingAccountId) {
        params.push(filter.tradingAccountId);
        conditions.push(`t.trading_account_id = $${params.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `
        SELECT 
          t.*,
          u.email as user_email,
          CONCAT(u.first_name, ' ', u.last_name) as user_name,
          a.account_number,
          a.platform
        FROM account_transfers t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN trading_accounts a ON t.trading_account_id = a.id
        ${whereClause}
        ORDER BY t.created_at DESC
      `;
      return query(sql, params);
    } else {
      let list = Array.from(inMemoryDb.accountTransfers.values());
      if (filter?.userId) {
        list = list.filter((t) => t.user_id === filter.userId);
      }
      if (filter?.status) {
        list = list.filter((t) => t.status === filter.status);
      }
      if (filter?.tradingAccountId) {
        list = list.filter((t) => t.trading_account_id === filter.tradingAccountId);
      }

      const hydrated = list.map((t) => {
        let userEmail: string | undefined;
        let userName: string | undefined;
        let accountNumber: string | undefined;
        let platform: string | undefined;

        for (const u of inMemoryDb.users.values()) {
          if (u.id === t.user_id) {
            userEmail = u.email;
            userName = `${u.first_name} ${u.last_name}`.trim();
            break;
          }
        }

        const acc = inMemoryDb.tradingAccounts.get(t.trading_account_id);
        if (acc) {
          accountNumber = acc.account_number;
          platform = acc.platform;
        }

        return {
          ...t,
          user_email: userEmail,
          user_name: userName,
          account_number: accountNumber,
          platform: platform,
        };
      });

      hydrated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return hydrated;
    }
  }

  /**
   * ADMIN: Approves a pending transfer request between Wallet and Trading Account.
   * Atomically:
   * 1. Validates request is pending (guards against duplicate or concurrent approvals)
   * 2. Validates authoritative balance at approval time
   * 3. Executes exact decimal arithmetic for wallet and trading account
   * 4. Debits source, credits destination
   * 5. Creates immutable ledger entry in transactions
   * 6. Marks transfer as approved
   * 7. Logs comprehensive audit record and notifies client
   */
  public static async approveAccountTransfer(
    transferId: string,
    adminId: string,
    input?: ApproveAccountTransferInput,
    ip?: string,
    userAgent?: string
  ): Promise<{
    transfer: AccountTransferRecord;
    transaction: TransactionRecord;
    wallet: WalletWithAvailable;
    trading_account: any;
  }> {
    const pool = getPool();
    let transfer: AccountTransferRecord | null = null;

    if (pool) {
      const rows = await query<AccountTransferRecord>('SELECT * FROM account_transfers WHERE id = $1', [transferId]);
      transfer = rows[0] || null;
    } else {
      transfer = inMemoryDb.accountTransfers.get(transferId) || null;
    }

    if (!transfer) {
      const err: any = new Error(`Transfer request "${transferId}" not found`);
      err.statusCode = 404;
      throw err;
    }

    if (transfer.status !== 'pending') {
      const err: any = new Error(`Cannot approve transfer in "${transfer.status}" status. Only pending transfers can be approved.`);
      err.statusCode = 400;
      throw err;
    }

    const wallet = await this.getOrCreateWallet(transfer.user_id, transfer.currency);
    const tradingAccount = await TradingAccountService.findRawAccount(transfer.trading_account_id);
    if (!tradingAccount) {
      const err: any = new Error(`Trading account "${transfer.trading_account_id}" not found`);
      err.statusCode = 404;
      throw err;
    }

    const transferAmountDec = toDecimal(transfer.amount);
    const now = new Date();
    const txnNo = this.generateReference('TXN');
    const txnId = crypto.randomUUID();

    let walletBalanceAfterDec: Decimal;
    let tradingBalanceAfterDec: Decimal;
    let transactionRecord: TransactionRecord;

    const walletBalanceBeforeDec = toDecimal(wallet.balance);
    const walletReservedDec = toDecimal(wallet.reserved_balance);
    const tradingBalanceBeforeDec = toDecimal(tradingAccount.balance || '0.00');

    const walletBalBeforeStr = formatMoney(walletBalanceBeforeDec);
    const walletResStr = formatMoney(walletReservedDec);
    const tradingBalBeforeStr = formatMoney(tradingBalanceBeforeDec);

    if (transfer.direction === 'wallet_to_trading') {
      // Validate wallet has sufficient available balance
      const walletAvailDec = toDecimal(wallet.available_balance);
      if (walletAvailDec.lessThan(transferAmountDec)) {
        throw new Error(
          `Insufficient wallet funds for approval. Available: $${wallet.available_balance} ${wallet.currency}, Requested: $${transfer.amount}`
        );
      }

      // Wallet debited, Trading account credited
      walletBalanceAfterDec = walletBalanceBeforeDec.minus(transferAmountDec);
      tradingBalanceAfterDec = tradingBalanceBeforeDec.plus(transferAmountDec);

      const walletBalAfterStr = formatMoney(walletBalanceAfterDec);

      transactionRecord = {
        id: txnId,
        transaction_no: txnNo,
        user_id: transfer.user_id,
        wallet_id: wallet.id,
        type: 'transfer_out',
        amount: formatMoney(transferAmountDec),
        currency: wallet.currency,
        balance_before: walletBalBeforeStr,
        balance_after: walletBalAfterStr,
        reserved_before: walletResStr,
        reserved_after: walletResStr,
        status: 'completed',
        reference_type: 'account_transfer',
        reference_id: transfer.id,
        description: `Transfer to Trading Account #${tradingAccount.account_number} (${tradingAccount.platform}) [Ref: ${transfer.reference_no}]`,
        created_at: now,
      };
    } else if (transfer.direction === 'trading_to_wallet') {
      // Validate trading account has sufficient balance
      if (tradingBalanceBeforeDec.lessThan(transferAmountDec)) {
        throw new Error(
          `Insufficient trading account balance for approval. Current balance: $${tradingBalBeforeStr} ${tradingAccount.currency}, Requested: $${transfer.amount}`
        );
      }

      // Trading account debited, Wallet credited
      tradingBalanceAfterDec = tradingBalanceBeforeDec.minus(transferAmountDec);
      walletBalanceAfterDec = walletBalanceBeforeDec.plus(transferAmountDec);

      const walletBalAfterStr = formatMoney(walletBalanceAfterDec);

      transactionRecord = {
        id: txnId,
        transaction_no: txnNo,
        user_id: transfer.user_id,
        wallet_id: wallet.id,
        type: 'transfer_in',
        amount: formatMoney(transferAmountDec),
        currency: wallet.currency,
        balance_before: walletBalBeforeStr,
        balance_after: walletBalAfterStr,
        reserved_before: walletResStr,
        reserved_after: walletResStr,
        status: 'completed',
        reference_type: 'account_transfer',
        reference_id: transfer.id,
        description: `Transfer from Trading Account #${tradingAccount.account_number} (${tradingAccount.platform}) [Ref: ${transfer.reference_no}]`,
        created_at: now,
      };
    } else {
      throw new Error(`Invalid transfer direction: ${transfer.direction}`);
    }

    const walletBalAfterStr = formatMoney(walletBalanceAfterDec);
    const tradingBalAfterStr = formatMoney(tradingBalanceAfterDec);

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Atomic status transition with concurrency check
        const updateRes = await client.query(
          `UPDATE account_transfers 
           SET status = 'approved', approved_by = $1, approved_at = $2, admin_notes = $3, updated_at = $4
           WHERE id = $5 AND status = 'pending'
           RETURNING id`,
          [adminId, now, input?.admin_notes || null, now, transfer.id]
        );

        // Check for concurrent approval
        if (updateRes.rows.length === 0) {
          throw new Error('Concurrent transfer update detected: transfer was already processed or is no longer pending.');
        }

        // Update wallet balance
        await client.query(
          `UPDATE wallets SET balance = $1, updated_at = $2 WHERE id = $3`,
          [walletBalAfterStr, now, wallet.id]
        );

        // Insert transaction ledger record
        await client.query(
          `INSERT INTO transactions (id, transaction_no, user_id, wallet_id, type, amount, currency, balance_before, balance_after, reserved_before, reserved_after, status, reference_type, reference_id, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            transactionRecord.id,
            transactionRecord.transaction_no,
            transactionRecord.user_id,
            transactionRecord.wallet_id,
            transactionRecord.type,
            transactionRecord.amount,
            transactionRecord.currency,
            transactionRecord.balance_before,
            transactionRecord.balance_after,
            transactionRecord.reserved_before,
            transactionRecord.reserved_after,
            transactionRecord.status,
            transactionRecord.reference_type,
            transactionRecord.reference_id,
            transactionRecord.description,
            transactionRecord.created_at,
          ]
        );

        // Update trading account balance
        await client.query(
          `UPDATE trading_accounts 
           SET balance = $1, updated_at = $2
           WHERE id = $3`,
          [tradingBalAfterStr, now, tradingAccount.id]
        );

        await client.query('COMMIT');
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }

      transfer.status = 'approved';
      transfer.approved_by = adminId;
      transfer.approved_at = now;
      transfer.admin_notes = input?.admin_notes || null;
      transfer.updated_at = now;
    } else {
      // In-Memory state update with concurrency check
      const current = inMemoryDb.accountTransfers.get(transfer.id);
      if (!current || current.status !== 'pending') {
        throw new Error('Concurrent transfer update detected: transfer was already processed or is no longer pending.');
      }

      transfer.status = 'approved';
      transfer.approved_by = adminId;
      transfer.approved_at = now;
      transfer.admin_notes = input?.admin_notes || null;
      transfer.updated_at = now;

      wallet.balance = walletBalAfterStr;
      wallet.updated_at = now;
      inMemoryDb.wallets.set(wallet.id, wallet);
      inMemoryDb.wallets.set(`${wallet.user_id}_${wallet.currency}`, wallet);

      await TradingAccountService.updateAccountBalance(tradingAccount.id, tradingBalAfterStr);

      inMemoryDb.transactions.unshift(transactionRecord);
    }

    await this.recordAuditLog(
      adminId,
      'TRANSFER_APPROVED',
      'account_transfer',
      transfer.id,
      {
        reference_no: transfer.reference_no,
        direction: transfer.direction,
        amount: transfer.amount,
        currency: transfer.currency,
        trading_account_id: tradingAccount.id,
        account_number: tradingAccount.account_number,
        wallet_balance_before: walletBalBeforeStr,
        wallet_balance_after: walletBalAfterStr,
        trading_balance_before: tradingBalBeforeStr,
        trading_balance_after: tradingBalAfterStr,
        admin_notes: input?.admin_notes || null,
      },
      ip,
      userAgent
    );

    await NotificationService.createNotification(
      transfer.user_id,
      'Transfer Request Approved',
      `Your transfer of $${transfer.amount} ${transfer.currency} (${transfer.reference_no}) between Wallet and Trading Account #${tradingAccount.account_number} has been approved.`,
      'trading_account',
      {
        transfer_id: transfer.id,
        reference_no: transfer.reference_no,
        amount: transfer.amount,
        currency: transfer.currency,
        direction: transfer.direction,
      }
    );

    const updatedWallet = await this.getOrCreateWallet(transfer.user_id, transfer.currency);
    const updatedAccount = await TradingAccountService.findRawAccount(tradingAccount.id);

    return {
      transfer,
      transaction: transactionRecord,
      wallet: updatedWallet,
      trading_account: updatedAccount,
    };
  }

  /**
   * ADMIN: Rejects a pending transfer request.
   * Marks request as rejected with reason. No balances are moved.
   */
  public static async rejectAccountTransfer(
    transferId: string,
    adminId: string,
    input?: RejectAccountTransferInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ transfer: AccountTransferRecord }> {
    const pool = getPool();
    let transfer: AccountTransferRecord | null = null;

    if (pool) {
      const rows = await query<AccountTransferRecord>('SELECT * FROM account_transfers WHERE id = $1', [transferId]);
      transfer = rows[0] || null;
    } else {
      transfer = inMemoryDb.accountTransfers.get(transferId) || null;
    }

    if (!transfer) {
      const err: any = new Error(`Transfer request "${transferId}" not found`);
      err.statusCode = 404;
      throw err;
    }

    if (transfer.status !== 'pending') {
      const err: any = new Error(`Cannot reject transfer in "${transfer.status}" status. Only pending transfers can be rejected.`);
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const reason = input?.rejection_reason || 'Rejected by administrator';

    if (pool) {
      const updateRes: any = await query(
        `UPDATE account_transfers 
         SET status = 'rejected', rejected_by = $1, rejected_at = $2, rejection_reason = $3, admin_notes = $4, updated_at = $5
         WHERE id = $6 AND status = 'pending'
         RETURNING id`,
        [adminId, now, reason, input?.admin_notes || null, now, transfer.id]
      );

      if (Array.isArray(updateRes) && updateRes.length === 0) {
        throw new Error('Concurrent transfer update detected: transfer was already processed or is no longer pending.');
      }

      transfer.status = 'rejected';
      transfer.rejected_by = adminId;
      transfer.rejected_at = now;
      transfer.rejection_reason = reason;
      transfer.admin_notes = input?.admin_notes || null;
      transfer.updated_at = now;
    } else {
      // In-Memory state update with concurrency check
      const current = inMemoryDb.accountTransfers.get(transfer.id);
      if (!current || current.status !== 'pending') {
        throw new Error('Concurrent transfer update detected: transfer was already processed or is no longer pending.');
      }

      transfer.status = 'rejected';
      transfer.rejected_by = adminId;
      transfer.rejected_at = now;
      transfer.rejection_reason = reason;
      transfer.admin_notes = input?.admin_notes || null;
      transfer.updated_at = now;
    }

    await this.recordAuditLog(
      adminId,
      'TRANSFER_REJECTED',
      'account_transfer',
      transfer.id,
      {
        reference_no: transfer.reference_no,
        direction: transfer.direction,
        amount: transfer.amount,
        currency: transfer.currency,
        trading_account_id: transfer.trading_account_id,
        rejection_reason: reason,
        admin_notes: input?.admin_notes || null,
      },
      ip,
      userAgent
    );

    await NotificationService.createNotification(
      transfer.user_id,
      'Transfer Request Rejected',
      `Your transfer request ${transfer.reference_no} ($${transfer.amount} ${transfer.currency}) was rejected: ${reason}`,
      'trading_account',
      {
        transfer_id: transfer.id,
        reference_no: transfer.reference_no,
        amount: transfer.amount,
        currency: transfer.currency,
        rejection_reason: reason,
      }
    );

    return { transfer };
  }
}
