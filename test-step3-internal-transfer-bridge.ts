// =============================================================================
// TEST SUITE: STEP 3 — INTERNAL TRANSFER FIX & TRADING ENGINE BRIDGE
// =============================================================================
process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';
process.env.CRM_USE_LOCAL_ENGINE = 'true';
process.env.JWT_SECRET = 'jwt-secret-key-1234567890-abcdefg-test-secret';
process.env.CRM_LAUNCH_SECRET = 'crm-launch-secret-key-32-chars-long-secure-token';
process.env.CRM_M2M_SECRET = 'test_only_crm_m2m_secret_at_least_32_characters_long_for_test!';

import assert from 'assert';
import { FinancialService } from './netlify/functions/services/financial.service';
import { TradingAccountService } from './netlify/functions/services/trading-account.service';
import { TradingEngineBridgeService } from './netlify/functions/services/trading-engine-bridge.service';
import { TradingRuntimeService } from './src/trading-engine';
import { inMemoryDb, UserRecord, TradingAccountRecord } from './netlify/functions/db/client';
import { handler as netlifyHandler } from './netlify/functions/api';
import { generateToken } from './netlify/functions/middleware/auth';
import { toDecimal, formatMoney } from './netlify/functions/services/financial-math';

let totalTests = 0;
let passedTests = 0;

function check(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function runStep3BridgeTestSuite() {
  console.log('=============================================================================');
  console.log('🚀 STEP 3: INTERNAL TRANSFER FIX & TRADING ENGINE BRIDGE TEST SUITE');
  console.log('=============================================================================\n');

  // Reset in-memory databases and engine runtime
  inMemoryDb.users.clear();
  inMemoryDb.wallets.clear();
  inMemoryDb.deposits.clear();
  inMemoryDb.withdrawals.clear();
  inMemoryDb.accountTransfers.clear();
  inMemoryDb.transactions.length = 0;
  inMemoryDb.tradingAccounts.clear();
  inMemoryDb.auditLogs.length = 0;
  inMemoryDb.notifications.length = 0;

  TradingRuntimeService.seedDefaultState();

  // -------------------------------------------------------------------------
  // 1. SETUP TEST ACTORS & LIVE TRADING ACCOUNT
  // -------------------------------------------------------------------------
  console.log('--- [Phase 1] Test Setup & Seed Data ---');
  const userId = 'client-trader-uuid-3001';
  const user: UserRecord = {
    id: userId,
    email: 'trader3001@broker.local',
    password_hash: '$2a$10$hashedPassword',
    role: 'client',
    status: 'active',
    first_name: 'Alex',
    last_name: 'Mercer',
    country: 'US',
    preferred_currency: 'USD',
    created_at: new Date(),
    updated_at: new Date(),
  };
  inMemoryDb.users.set(user.email, user);
  const clientToken = generateToken(user);

  // Setup client wallet with $5,000.00
  const wallet = await FinancialService.getOrCreateWallet(userId, 'USD');
  wallet.balance = '5000.00';
  wallet.reserved_balance = '0.00';
  inMemoryDb.wallets.set(wallet.id, wallet);
  inMemoryDb.wallets.set(`${userId}_USD`, wallet);

  // Setup trading account #57775 in CRM, corresponding to runtime account in Trading Engine
  const tradingAccount: TradingAccountRecord = {
    id: 'acc_crm_live_57775',
    user_id: userId,
    account_number: '57775',
    platform: 'MT5',
    account_type: 'standard',
    server_name: 'MetaQuotes-Live',
    currency: 'USD',
    leverage: '1:500',
    status: 'active',
    is_demo: false,
    balance: '50000.00',
    created_at: new Date(),
    updated_at: new Date(),
  };
  inMemoryDb.tradingAccounts.set(tradingAccount.id, tradingAccount);

  // Verify initial Trading Engine runtime state
  const engineInitial = await TradingRuntimeService.getAccountRuntimeState('57775');
  check(engineInitial.balance === 50000, 'Initial Trading Engine runtime balance is $50,000.00');
  check(engineInitial.freeMargin === 50000, 'Initial Trading Engine runtime free margin is $50,000.00');

  // -------------------------------------------------------------------------
  // 2. WALLET -> TRADING ACCOUNT INSTANT AUTO-EXECUTION (FIX FOR ISSUE 1 & 2)
  // -------------------------------------------------------------------------
  console.log('\n--- [Phase 2] Wallet -> Trading Account Instant Auto-Execution ---');
  const transferW2T = await FinancialService.createAccountTransfer(userId, {
    trading_account_id: tradingAccount.id,
    direction: 'wallet_to_trading',
    amount: '1500.00',
    currency: 'USD',
    client_notes: 'Deposit into scalper margin',
    auto_execute: true,
  });

  check(transferW2T.status === 'completed', 'Transfer status is immediately completed (no admin approval required)');
  check(transferW2T.execution_status === 'confirmed', 'Execution status is confirmed');
  check(typeof transferW2T.external_transaction_id === 'string' && transferW2T.external_transaction_id.length > 0, 'External transaction ID recorded from engine execution');
  check(transferW2T.executed_at !== null, 'Execution timestamp recorded');

  // Verify CRM Wallet balance was debited $1,500.00 ($5000 -> $3500)
  const walletAfterW2T = await FinancialService.getOrCreateWallet(userId, 'USD');
  check(walletAfterW2T.balance === '3500.00', 'Wallet balance debited exactly $1,500.00 ($5000.00 -> $3500.00)');
  check(walletAfterW2T.reserved_balance === '0.00', 'Reserved balance remains 0.00 (settled immediately)');
  check(walletAfterW2T.available_balance === '3500.00', 'Available balance is $3500.00');

  // CRITICAL CHECK: Verify Trading Engine runtime trading-account balance INCREASED ($50,000 -> $51,500)
  const engineAfterW2T = await TradingRuntimeService.getAccountRuntimeState('57775');
  check(engineAfterW2T.balance === 51500, 'Trading Engine runtime balance authoritatively increased to $51,500.00');
  check(engineAfterW2T.freeMargin === 51500, 'Trading Engine runtime free margin increased to $51,500.00');

  // Verify CRM cached trading account balance synchronized
  const crmAccountAfterW2T = await TradingAccountService.findRawAccount(tradingAccount.id);
  check(crmAccountAfterW2T?.balance === '51500.00', 'CRM cached trading account balance updated to $51,500.00');

  // Verify immutable ledger entry
  const transferOutTxn = inMemoryDb.transactions.find(
    (t) => t.reference_id === transferW2T.id && t.type === 'transfer_out'
  );
  check(transferOutTxn !== undefined, 'Immutable ledger transaction transfer_out recorded');
  check(transferOutTxn?.status === 'completed', 'Ledger transaction status is completed');
  check(transferOutTxn?.amount === '1500.00', 'Ledger transaction amount is $1500.00');
  check(transferOutTxn?.balance_after === '3500.00', 'Ledger balance_after is $3500.00');

  // -------------------------------------------------------------------------
  // 3. TRADING ACCOUNT -> WALLET INSTANT AUTO-EXECUTION (WITH FREE MARGIN CHECK)
  // -------------------------------------------------------------------------
  console.log('\n--- [Phase 3] Trading Account -> Wallet Instant Auto-Execution ---');
  const transferT2W = await FinancialService.createAccountTransfer(userId, {
    trading_account_id: tradingAccount.id,
    direction: 'trading_to_wallet',
    amount: '2000.00',
    currency: 'USD',
    client_notes: 'Profit withdrawal to CRM wallet',
    auto_execute: true,
  });

  check(transferT2W.status === 'completed', 'T2W Transfer completed immediately without admin approval');
  check(transferT2W.execution_status === 'confirmed', 'T2W execution_status is confirmed');
  check(typeof transferT2W.external_transaction_id === 'string', 'T2W external transaction ID recorded from engine execution');

  // Verify Trading Engine runtime balance DECREASED ($51,500 -> $49,500)
  const engineAfterT2W = await TradingRuntimeService.getAccountRuntimeState('57775');
  check(engineAfterT2W.balance === 49500, 'Trading Engine runtime balance decreased to $49,500.00');
  check(engineAfterT2W.freeMargin === 49500, 'Trading Engine runtime free margin decreased to $49,500.00');

  // Verify CRM Wallet balance CREDITED ($3,500 -> $5,500)
  const walletAfterT2W = await FinancialService.getOrCreateWallet(userId, 'USD');
  check(walletAfterT2W.balance === '5500.00', 'CRM Wallet balance credited $2,000.00 ($3500.00 -> $5500.00)');

  // Verify CRM cached trading account balance synchronized
  const crmAccountAfterT2W = await TradingAccountService.findRawAccount(tradingAccount.id);
  check(crmAccountAfterT2W?.balance === '49500.00', 'CRM cached trading account balance synchronized to $49,500.00');

  // Verify immutable ledger entry
  const transferInTxn = inMemoryDb.transactions.find(
    (t) => t.reference_id === transferT2W.id && t.type === 'transfer_in'
  );
  check(transferInTxn !== undefined, 'Immutable ledger transaction transfer_in recorded');
  check(transferInTxn?.status === 'completed', 'Ledger transaction status is completed');
  check(transferInTxn?.balance_after === '5500.00', 'Ledger balance_after is $5500.00');

  // -------------------------------------------------------------------------
  // 4. FREE MARGIN ENFORCEMENT ON TRADING -> WALLET
  // -------------------------------------------------------------------------
  console.log('\n--- [Phase 4] Trading Engine Free Margin Protection ---');
  let marginRejected = false;
  try {
    // Attempt to withdraw $60,000 when engine balance is $49,500
    await FinancialService.createAccountTransfer(userId, {
      trading_account_id: tradingAccount.id,
      direction: 'trading_to_wallet',
      amount: '60000.00',
      currency: 'USD',
      auto_execute: true,
    });
  } catch (err: any) {
    marginRejected = true;
    check(err.message.includes('exceeds available withdrawable free margin') || err.message.includes('INSUFFICIENT_FREE_MARGIN'), 'Trading Engine rejected debit due to insufficient free margin');
  }
  check(marginRejected, 'Withdrawal exceeding free margin was strictly blocked');

  // Verify Wallet balance remained untouched at $5,500.00
  const walletAfterRejected = await FinancialService.getOrCreateWallet(userId, 'USD');
  check(walletAfterRejected.balance === '5500.00', 'Wallet balance untouched after rejected debit ($5500.00)');

  // -------------------------------------------------------------------------
  // 5. INSUFFICIENT WALLET BALANCE PROTECTION ON WALLET -> TRADING
  // -------------------------------------------------------------------------
  console.log('\n--- [Phase 5] CRM Wallet Available Balance Protection ---');
  let walletRejected = false;
  try {
    // Attempt to transfer $10,000 when wallet balance is $5,500
    await FinancialService.createAccountTransfer(userId, {
      trading_account_id: tradingAccount.id,
      direction: 'wallet_to_trading',
      amount: '10000.00',
      currency: 'USD',
      auto_execute: true,
    });
  } catch (err: any) {
    walletRejected = true;
    check(err.message.includes('Insufficient wallet balance'), 'CRM rejected transfer due to insufficient wallet balance');
  }
  check(walletRejected, 'Transfer exceeding wallet balance was strictly blocked');

  // -------------------------------------------------------------------------
  // 6. REST API ENDPOINT POST /api/financial/transfers
  // -------------------------------------------------------------------------
  console.log('\n--- [Phase 6] REST API Client Experience Probing ---');
  const apiEvent = {
    httpMethod: 'POST',
    path: '/api/financial/transfers',
    headers: {
      Authorization: `Bearer ${clientToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trading_account_id: tradingAccount.id,
      direction: 'wallet_to_trading',
      amount: '500.00',
      currency: 'USD',
      client_notes: 'REST API instant transfer',
    }),
  };

  const apiRes: any = await netlifyHandler(apiEvent as any, {} as any);
  check(apiRes.statusCode === 201, 'POST /api/financial/transfers returns HTTP 201 Created');
  const apiBody = JSON.parse(apiRes.body);
  check(apiBody.status === 'success', 'API response reports status success');
  check(apiBody.data.status === 'completed', 'API transfer data shows status completed immediately');
  check(apiBody.data.execution_status === 'confirmed', 'API transfer data shows execution_status confirmed');

  // Verify wallet balance: $5500 - $500 = $5000
  const walletAfterApi = await FinancialService.getOrCreateWallet(userId, 'USD');
  check(walletAfterApi.balance === '5000.00', 'Wallet balance reflects $500.00 debit ($5000.00)');

  // Verify Trading Engine balance: $49,500 + $500 = $50,000
  const engineAfterApi = await TradingRuntimeService.getAccountRuntimeState('57775');
  check(engineAfterApi.balance === 50000, 'Trading Engine balance increased by $500.00 to $50,000.00');

  // -------------------------------------------------------------------------
  // 7. COMPATIBILITY WITH MANUAL WORKFLOW & CONFIRM EXECUTION
  // -------------------------------------------------------------------------
  console.log('\n--- [Phase 7] Manual Governance Compatibility & Confirm Execution ---');
  const manualTransfer = await FinancialService.createAccountTransfer(userId, {
    trading_account_id: tradingAccount.id,
    direction: 'wallet_to_trading',
    amount: '300.00',
    currency: 'USD',
    client_notes: 'Manual broker workflow test',
    auto_execute: false, // Explicitly requesting manual approval queue
  });

  check(manualTransfer.status === 'pending', 'Manual mode transfer has status pending');
  check(manualTransfer.execution_status === 'unexecuted', 'Manual mode transfer execution_status is unexecuted');

  // Admin approves manual transfer
  const adminApprove = await FinancialService.approveAccountTransfer(manualTransfer.id, 'admin-uuid-001', {
    admin_notes: 'Approved by desk',
  });
  check(adminApprove.transfer.status === 'approved', 'Transfer status is approved');
  check(adminApprove.transfer.execution_status === 'executing', 'Transfer execution_status is executing');

  // Admin confirms execution -> calls bridge and synchronizes balance
  const confirmResult = await FinancialService.confirmExecution(manualTransfer.id, 'admin-uuid-001', {
    external_transaction_id: 'MANUAL-EXEC-99128',
    execution_notes: 'Executed on bridge',
  });
  check(confirmResult.transfer.status === 'completed', 'Confirmed transfer status is completed');
  check(confirmResult.transfer.execution_status === 'confirmed', 'Confirmed transfer execution_status is confirmed');

  // Engine runtime balance: $50,000 + $300 = $50,300
  const engineFinal = await TradingRuntimeService.getAccountRuntimeState('57775');
  check(engineFinal.balance === 50300, 'Trading Engine runtime balance updated upon confirmExecution to $50,300.00');

  console.log('\n=============================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 3 BRIDGE ACCEPTANCE TESTS PASSED!`);
  console.log('=============================================================================\n');
}

runStep3BridgeTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
