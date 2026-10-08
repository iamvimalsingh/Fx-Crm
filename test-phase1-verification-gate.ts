/**
 * Phase 1 Final Verification Gate Test Suite
 * Validates:
 * 1. Database Fallback Safety (Fail-closed in production)
 * 2. Trading SSO Secret Isolation (Dedicated CRM_LAUNCH_SECRET required in production)
 * 3. Provisioning Truth (No false ACTIVE state without remote engine success)
 * 4. Ambiguous Remote Success / Network Retry (Strict idempotency, exactly one effect)
 * 5. Financial Locking & Conservation of Funds (Available balance protection)
 * 6. Authorization Denial on Privileged Roles
 * 7. Audit Log Secret Sanitization
 */

import { DatabaseGuard, DatabaseSecurityError } from './netlify/functions/db/guard';
import { inMemoryDb } from './netlify/functions/db/client';
import {
  getCrmLaunchSecret,
  getJwtSecret,
  CrmLaunchSecretConfigurationError,
  JwtConfigurationError,
  hasAdminPermission,
  verifyToken,
  generateTradingLaunchToken,
} from './netlify/functions/middleware/auth';
import { TradingAccountService } from './netlify/functions/services/trading-account.service';
import { FinancialService } from './netlify/functions/services/financial.service';
import { TradingEngineBridgeService } from './netlify/functions/services/trading-engine-bridge.service';
import { TradingRuntimeService } from './src/trading-engine/services/runtime.service';
import { IdempotencyService } from './src/trading-engine/services/idempotency.service';
import { toDecimal, formatMoney, canWithdraw } from './netlify/functions/services/financial-math';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

async function runPhase1VerificationGate() {
  console.log('=============================================================================');
  console.log('🛡️  PHASE 1 FINAL VERIFICATION GATE — EVIDENCE-BASED AUDIT');
  console.log('=============================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. DATABASE FALLBACK SAFETY (FAIL-CLOSED IN PRODUCTION)
  // ---------------------------------------------------------------------------
  console.log('--- [Gate 1] Database Fallback Safety (Fail-Closed in Production) ---');
  {
    const originalEnv = process.env.NODE_ENV;
    const originalVercel = process.env.VERCEL;

    try {
      // Simulate production environment
      process.env.NODE_ENV = 'production';
      process.env.CRM_TEST_MODE = 'false';

      assert(DatabaseGuard.isProduction() === true, 'DatabaseGuard detects production mode');

      let securityErrorThrown = false;
      try {
        // Attempting to access in-memory store in production MUST throw DatabaseSecurityError
        const _ = inMemoryDb.users;
      } catch (err: any) {
        if (err instanceof DatabaseSecurityError || err.name === 'DatabaseSecurityError') {
          securityErrorThrown = true;
        }
      }
      assert(securityErrorThrown, 'inMemoryDb access in production fails closed with DatabaseSecurityError');
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.VERCEL = originalVercel;
      process.env.CRM_TEST_MODE = 'true';
    }
  }

  // ---------------------------------------------------------------------------
  // 2. TRADING SSO SECRET ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- [Gate 2] Trading SSO Secret Isolation ---');
  {
    const originalEnv = process.env.NODE_ENV;
    const originalLaunchSecret = process.env.CRM_LAUNCH_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.CRM_LAUNCH_SECRET;

      let launchSecretErrorThrown = false;
      try {
        getCrmLaunchSecret();
      } catch (err: any) {
        if (err instanceof CrmLaunchSecretConfigurationError || err.name === 'CrmLaunchSecretConfigurationError') {
          launchSecretErrorThrown = true;
        }
      }
      assert(
        launchSecretErrorThrown,
        'Missing CRM_LAUNCH_SECRET in production fails closed with CrmLaunchSecretConfigurationError'
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.CRM_LAUNCH_SECRET = originalLaunchSecret;
      process.env.CRM_TEST_MODE = 'true';
    }
  }

  // ---------------------------------------------------------------------------
  // 3. PROVISIONING TRUTH
  // ---------------------------------------------------------------------------
  console.log('\n--- [Gate 3] Provisioning Truth (No False Active Status) ---');
  {
    inMemoryDb.clear();
    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();

    // Seed a pending account
    inMemoryDb.tradingAccounts.set(accountId, {
      id: accountId,
      account_number: '990011',
      user_id: userId,
      platform: 'MT5',
      account_type: 'standard',
      server_name: 'MT5-Demo',
      currency: 'USD',
      leverage: '1:100',
      status: 'pending_approval',
      nickname: 'Pending Account',
      is_demo: false,
      group_tier: 'standard_usd',
      created_at: new Date(),
      updated_at: new Date(),
      approved_at: null,
      approved_by: null,
      password: null,
      balance: '0.00',
      terminal_url: null,
    });

    // Mock TradingEngineBridgeService to simulate a remote failure
    const originalProvision = TradingEngineBridgeService.provisionTradingAccount;
    TradingEngineBridgeService.provisionTradingAccount = async () => {
      throw new Error('Remote Trading Platform unavailable (503 Service Unavailable)');
    };

    try {
      const result = await TradingAccountService.approveAccount('admin-1', accountId, {
        admin_notes: 'Approving under network failure test',
      });

      assert(
        result.status === 'pending_approval',
        'Account status remains pending_approval when remote provisioning fails'
      );
      assert(
        result.provisioning_status === 'failed',
        'Provisioning status is marked failed on remote error'
      );
      assert(
        result.trading_enabled === false,
        'trading_enabled is strictly false on failed provisioning'
      );
    } finally {
      TradingEngineBridgeService.provisionTradingAccount = originalProvision;
    }
  }

  // ---------------------------------------------------------------------------
  // 4. AMBIGUOUS REMOTE SUCCESS & IDEMPOTENCY RETRY
  // ---------------------------------------------------------------------------
  console.log('\n--- [Gate 4] Ambiguous Remote Success & Network Retry Safety ---');
  {
    const accountId = 'acc_idempotent_test_' + Date.now();
    const initBalance = 10000;

    TradingRuntimeService.upsertAccount({
      id: accountId,
      accountNumber: 'IDEMPO_' + Date.now(),
      tenantId: 'default',
      currency: 'USD',
      balance: initBalance,
      equity: initBalance,
      usedMargin: 0,
      freeMargin: initBalance,
      marginLevel: 0,
      status: 'ACTIVE',
      tradingEnabled: true,
      stopOutLevel: 50,
      marginCallLevel: 100,
      sessionMode: 'LIVE',
      platform: 'MT5',
      accountType: 'standard',
      leverage: 100,
    });

    const idempotencyKey = 'idemp_key_ref_' + crypto.randomUUID();
    const creditPayload = {
      accountId,
      accountNumber: 'IDEMPO_' + Date.now(),
      amount: 2500,
      currency: 'USD',
      referenceNo: 'TRF-998811',
      idempotencyKey,
      tenantId: 'default',
      adminUserId: 'm2m_admin',
    };

    // First funding call (simulating remote execution)
    const firstRes = await TradingRuntimeService.creditAccount(creditPayload);
    assert(firstRes.status === 200, 'Initial credit returns HTTP 200');
    assert(firstRes.body.newBalance === 12500, 'Initial credit increases balance to 12500');

    // Second funding call with identical idempotency key (simulating network retry after lost ACK)
    const retryRes = await TradingRuntimeService.creditAccount(creditPayload);
    assert(retryRes.status === 200, 'Retry credit returns cached HTTP 200');
    assert(retryRes.body.newBalance === 12500, 'Retry credit returns original balance 12500 (No double credit)');

    // Check runtime balance remains exactly 12500 (conservation of funds)
    const state = await TradingRuntimeService.getAccountRuntimeState(accountId, 'default');
    assert(state.balance === 12500, 'Runtime balance strictly maintained exactly one credit effect (12500)');

    // Third funding call with same idempotency key but conflicting payload MUST reject with 409
    let conflictThrown = false;
    try {
      await TradingRuntimeService.creditAccount({
        ...creditPayload,
        amount: 9999, // Altered amount
      });
    } catch (err: any) {
      if (err.statusCode === 409 || err.code === 'IDEMPOTENCY_CONFLICT') {
        conflictThrown = true;
      }
    }
    assert(conflictThrown, 'Idempotency conflict with altered payload returns 409 Conflict');
  }

  // ---------------------------------------------------------------------------
  // 5. FINANCIAL LOCKING & AVAILABLE BALANCE CONSERVATION
  // ---------------------------------------------------------------------------
  console.log('\n--- [Gate 5] Financial Math & Available Balance Conservation ---');
  {
    const balance = toDecimal('500.00');
    const reserved = toDecimal('200.00');
    const available = balance.minus(reserved);

    assert(available.equals(toDecimal('300.00')), 'Available balance calculation: 500.00 - 200.00 = 300.00');

    // Attempting to withdraw more than available
    const withdrawAttempt = toDecimal('350.00');
    const check = canWithdraw(formatMoney(available), withdrawAttempt, '10.00', '1000.00');
    assert(check.valid === false, 'Withdrawal exceeding available balance is strictly invalid');
    assert(check.reason?.includes('Insufficient') === true, 'Rejection reason states Insufficient available balance');

    // Mathematical precision test (no floating-point drift)
    const d1 = toDecimal('0.1');
    const d2 = toDecimal('0.2');
    assert(d1.plus(d2).equals(toDecimal('0.3')), 'Decimal.js prevents 0.1 + 0.2 floating-point drift');
  }

  // ---------------------------------------------------------------------------
  // 6. AUTHORIZATION SECURITY
  // ---------------------------------------------------------------------------
  console.log('\n--- [Gate 6] Authorization & Permission Guards ---');
  {
    const clientUser = { userId: 'u1', email: 'c@test.com', role: 'client' as const };
    const adminUser = { userId: 'u2', email: 'a@test.com', role: 'admin' as const };

    assert(hasAdminPermission(clientUser, 'FINANCE') === false, 'Client denied administrative FINANCE permission');
    assert(hasAdminPermission(clientUser, 'SYSTEM_ADMIN') === false, 'Client denied SYSTEM_ADMIN permission');
    assert(hasAdminPermission(adminUser, 'FINANCE') === true, 'Admin granted administrative FINANCE permission');

    // Malformed token rejection
    const verifyResult = verifyToken('invalid.jwt.token');
    assert(verifyResult === null, 'Malformed JWT token verification returns null');
  }

  // ---------------------------------------------------------------------------
  // 7. AUDIT LOG SECURITY & SANITIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- [Gate 7] Audit Log Sanitization & Secret Stripping ---');
  {
    inMemoryDb.clear();
    const adminId = crypto.randomUUID();
    const accountId = crypto.randomUUID();

    await TradingAccountService.recordAuditLog(
      adminId,
      'ADMIN_CONFIG_UPDATE',
      accountId,
      {
        action: 'UPDATE_KEY',
        password: 'SuperSecretPassword123!',
        jwt_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        CRM_LAUNCH_SECRET: 'launch_secret_should_never_leak',
        safeProperty: 'VisibleSafeValue',
      }
    );

    const log = inMemoryDb.auditLogs[0];
    assert(log !== undefined, 'Audit log recorded');
    assert(log.details?.password === '[REDACTED]', 'Password in audit log is [REDACTED]');
    assert(log.details?.jwt_token === '[REDACTED]', 'JWT token in audit log is [REDACTED]');
    assert(log.details?.CRM_LAUNCH_SECRET === '[REDACTED]', 'CRM_LAUNCH_SECRET in audit log is [REDACTED]');
    assert(log.details?.safeProperty === 'VisibleSafeValue', 'Non-sensitive properties preserved');
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n=============================================================================');
  console.log(`GATE VERIFICATION RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase1VerificationGate().catch((err) => {
  console.error('Gate execution failed:', err);
  process.exit(1);
});
