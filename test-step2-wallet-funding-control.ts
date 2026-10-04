// =============================================================================
// TEST SUITE: STEP 2 — WALLET & FUNDING CONTROL VERIFICATION
// =============================================================================
process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-key-1234567890-abcdefg-test-secret';
process.env.CRM_LAUNCH_SECRET = process.env.CRM_LAUNCH_SECRET || 'crm-launch-secret-key-32-chars-long-secure-token';

import { FinancialService } from './netlify/functions/services/financial.service';
import { TradingAccountService } from './netlify/functions/services/trading-account.service';
import { inMemoryDb } from './netlify/functions/db/client';
import { toDecimal, formatMoney } from './netlify/functions/services/financial-math';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runStep2TestSuite() {
  console.log('=============================================================================');
  console.log('🚀 RUNNING STEP 2: WALLET & FUNDING CONTROL VERIFICATION SUITE');
  console.log('=============================================================================\n');

  // Clear in-memory db for deterministic test environment
  inMemoryDb.users.clear();
  inMemoryDb.wallets.clear();
  inMemoryDb.deposits.clear();
  inMemoryDb.withdrawals.clear();
  inMemoryDb.accountTransfers.clear();
  inMemoryDb.transactions.length = 0;
  inMemoryDb.tradingAccounts.clear();
  inMemoryDb.auditLogs.length = 0;
  inMemoryDb.notifications.length = 0;

  // 1. Setup Test Actors
  console.log('--- [Phase 1] Test Actor Setup & Baseline Balances ---');
  const clientUserId = 'client-user-uuid-1001';
  const adminUserId = 'admin-user-uuid-9001';

  inMemoryDb.users.set(clientUserId, {
    id: clientUserId,
    email: 'trader1001@example.com',
    role: 'client',
    full_name: 'John Trader',
    status: 'active',
    created_at: new Date(),
  } as any);

  inMemoryDb.users.set(adminUserId, {
    id: adminUserId,
    email: 'finance-desk@example.com',
    role: 'admin',
    full_name: 'Broker Finance Officer',
    status: 'active',
    created_at: new Date(),
  } as any);

  // Setup Trading Account
  const tradingAcc = await TradingAccountService.registerAccount(clientUserId, {
    account_type: 'standard',
    currency: 'USD',
    leverage: '1:100',
    platform: 'MT5',
    is_demo: false,
  });
  // Simulate initial authoritative Trading Engine balance and active status
  tradingAcc.status = 'active';
  tradingAcc.balance = '500.00';
  (tradingAcc as any).equity = '500.00';
  inMemoryDb.tradingAccounts.set(tradingAcc.id, tradingAcc);

  // Setup Initial CRM Wallet with $2,000.00 cash
  const initialWallet = await FinancialService.getOrCreateWallet(clientUserId, 'USD');
  initialWallet.balance = '2000.00';
  initialWallet.reserved_balance = '0.00';
  inMemoryDb.wallets.set(initialWallet.id, initialWallet);
  inMemoryDb.wallets.set(`${clientUserId}_USD`, initialWallet);

  const walletBaseline = await FinancialService.getOrCreateWallet(clientUserId, 'USD');
  assert(walletBaseline.balance === '2000.00', 'Initial wallet balance is $2000.00');
  assert(walletBaseline.available_balance === '2000.00', 'Initial available balance is $2000.00');
  assert(walletBaseline.reserved_balance === '0.00', 'Initial reserved balance is $0.00');
  assert(tradingAcc.balance === '500.00', 'Initial Trading Engine account balance is $500.00');

  // 2. Deposit Lifecycle Verification
  console.log('\n--- [Phase 2] Deposit Lifecycle & Authoritative Ledger ---');
  const deposit = await FinancialService.createDeposit(clientUserId, {
    amount: '1000.00',
    currency: 'USD',
    client_notes: 'Wire transfer from Barclays',
  });
  assert(deposit.status === 'pending', 'Deposit created in pending status');

  const walletAfterDepositPending = await FinancialService.getOrCreateWallet(clientUserId, 'USD');
  assert(walletAfterDepositPending.balance === '2000.00', 'Wallet balance untouched while deposit pending');

  const approveDepositResult = await FinancialService.approveDeposit(deposit.id, adminUserId, {});
  assert(approveDepositResult.deposit.status === 'approved', 'Deposit approved by admin');
  assert(approveDepositResult.wallet.balance === '3000.00', 'Wallet balance credited to $3000.00 upon approval');
  assert(approveDepositResult.transaction.type === 'deposit', 'Deposit recorded in immutable ledger as type deposit');
  assert(approveDepositResult.transaction.balance_after === '3000.00', 'Ledger balance_after strictly reflects $3000.00');

  // 3. Withdrawal Reservation & Cancellation Lifecycle
  console.log('\n--- [Phase 3] Withdrawal Reservation & Cancellation Lifecycle ---');
  const withdrawal = await FinancialService.createWithdrawal(clientUserId, {
    amount: '500.00',
    currency: 'USD',
    payout_details: { bank: 'JPMorgan Chase', iban: 'US89370000001' },
    client_notes: 'Monthly withdrawal',
  });
  assert(withdrawal.withdrawal.status === 'pending', 'Withdrawal created in pending status');
  assert(withdrawal.wallet.balance === '3000.00', 'Wallet balance unchanged ($3000.00) during pending withdrawal');
  assert(withdrawal.wallet.reserved_balance === '500.00', 'Reserved balance increased to $500.00');
  assert(withdrawal.wallet.available_balance === '2500.00', 'Available balance decreased to $2500.00');
  assert(withdrawal.transaction.type === 'withdrawal_reserve', 'Ledger record withdrawal_reserve created');

  // Cancel withdrawal
  const cancelWithdrawalRes = await FinancialService.cancelWithdrawal(withdrawal.withdrawal.id, clientUserId);
  assert(cancelWithdrawalRes.withdrawal.status === 'cancelled', 'Withdrawal marked cancelled');
  assert(cancelWithdrawalRes.wallet.reserved_balance === '0.00', 'Reserved balance released back to $0.00');
  assert(cancelWithdrawalRes.wallet.available_balance === '3000.00', 'Available balance restored to $3000.00');
  const releaseWthTxn = inMemoryDb.transactions.find(
    (t) => t.reference_id === withdrawal.withdrawal.id && t.type === 'withdrawal_release'
  );
  assert(releaseWthTxn !== undefined, 'Ledger record withdrawal_release created');

  // 4. Wallet -> Trading Account Transfer Lifecycle (Phase 1: Reservation on Creation)
  console.log('\n--- [Phase 4] Wallet -> Trading Transfer Creation & Reservation ---');
  const transfer1 = await FinancialService.createAccountTransfer(clientUserId, {
    trading_account_id: tradingAcc.id,
    direction: 'wallet_to_trading',
    amount: '600.00',
    currency: 'USD',
    client_notes: 'Capital allocation for scalping',
  });
  assert(transfer1.status === 'pending', 'Transfer created with status: pending');
  assert(transfer1.execution_status === 'unexecuted', 'Transfer execution_status is unexecuted');
  assert(transfer1.direction === 'wallet_to_trading', 'Transfer direction is wallet_to_trading');

  const walletAfterTransfer1Creation = await FinancialService.getOrCreateWallet(clientUserId, 'USD');
  assert(walletAfterTransfer1Creation.balance === '3000.00', 'Wallet total balance remains $3000.00');
  assert(walletAfterTransfer1Creation.reserved_balance === '600.00', 'Wallet reserved balance is $600.00');
  assert(walletAfterTransfer1Creation.available_balance === '2400.00', 'Wallet available balance is $2400.00');

  // STRICT INVARIANT: Trading account balance MUST NOT be mutated!
  const tradingAccCheck1 = await TradingAccountService.findRawAccount(tradingAcc.id);
  assert(tradingAccCheck1?.balance === '500.00', 'CRITICAL: Trading account balance untouched on transfer creation');

  // Check ledger reserve transaction
  const reserveTxn = inMemoryDb.transactions.find(
    (t) => t.reference_id === transfer1.id && t.type === 'transfer_reserve'
  );
  assert(reserveTxn !== undefined, 'Immutable ledger transaction transfer_reserve recorded');
  assert(reserveTxn?.amount === '600.00', 'transfer_reserve amount is 600.00');

  // 5. Transfer Cancellation & Reserve Release
  console.log('\n--- [Phase 5] Transfer Client Cancellation & Reserve Release ---');
  const cancelTransferRes = await FinancialService.cancelAccountTransfer(transfer1.id, clientUserId);
  assert(cancelTransferRes.transfer.status === 'cancelled', 'Transfer marked cancelled');
  assert(cancelTransferRes.wallet.reserved_balance === '0.00', 'Reserved balance released to $0.00');
  assert(cancelTransferRes.wallet.available_balance === '3000.00', 'Available balance restored to $3000.00');

  const releaseTxn = inMemoryDb.transactions.find(
    (t) => t.reference_id === transfer1.id && t.type === 'transfer_release'
  );
  assert(releaseTxn !== undefined, 'Immutable ledger transaction transfer_release recorded');

  // 6. Wallet -> Trading Transfer Approval (No Fake Engine Mutation)
  console.log('\n--- [Phase 6] Wallet -> Trading Transfer Approval & Execution Queue ---');
  const transfer2 = await FinancialService.createAccountTransfer(clientUserId, {
    trading_account_id: tradingAcc.id,
    direction: 'wallet_to_trading',
    amount: '400.00',
    currency: 'USD',
    client_notes: 'Funding scalper account',
  });

  const approveRes = await FinancialService.approveAccountTransfer(transfer2.id, adminUserId, {
    admin_notes: 'Approved for MT5 bridge execution',
  });

  assert(approveRes.transfer.status === 'approved', 'Transfer status moved to approved');
  assert(approveRes.transfer.execution_status === 'executing', 'Transfer execution_status is executing');
  assert(approveRes.wallet.balance === '2600.00', 'Wallet balance debited $400.00 -> $2600.00 upon approval');
  assert(approveRes.wallet.reserved_balance === '0.00', 'Reserved balance cleared to $0.00 upon debit');
  assert(approveRes.transaction?.type === 'transfer_out', 'Ledger transaction transfer_out created');
  assert(approveRes.transaction?.balance_after === '2600.00', 'Ledger balance_after is 2600.00');

  // CRITICAL INVARIANT: CRM MUST NOT mutate trading_accounts.balance!
  const tradingAccCheck2 = await TradingAccountService.findRawAccount(tradingAcc.id);
  assert(
    tradingAccCheck2?.balance === '500.00',
    'CRITICAL: CRM did NOT mutate trading_accounts.balance upon approval (Authoritative Trading Engine separation preserved)'
  );

  // 7. Trading Engine Execution Confirmation
  console.log('\n--- [Phase 7] Confirming External Trading Engine Execution ---');
  const confirmRes = await FinancialService.confirmExecution(transfer2.id, adminUserId, {
    external_transaction_id: 'TE-MT5-TXN-884920',
    execution_notes: 'Executed via Render Trading Engine WS protocol',
  });

  assert(confirmRes.transfer.status === 'completed', 'Transfer status is completed');
  assert(confirmRes.transfer.execution_status === 'confirmed', 'Execution status is confirmed');
  assert(confirmRes.transfer.external_transaction_id === 'TE-MT5-TXN-884920', 'External transaction ID recorded');
  assert(confirmRes.transfer.executed_at !== null, 'executed_at timestamp recorded');
  assert(confirmRes.wallet.balance === '2600.00', 'Wallet balance remains settled at $2600.00');

  // 8. Execution Failure & Compensating Refund Ledger Invariant
  console.log('\n--- [Phase 8] Execution Failure & Compensating Ledger Refund ---');
  const transfer3 = await FinancialService.createAccountTransfer(clientUserId, {
    trading_account_id: tradingAcc.id,
    direction: 'wallet_to_trading',
    amount: '350.00',
    currency: 'USD',
    client_notes: 'High leverage transfer',
  });

  // Approve moves wallet: $2600 - $350 = $2250, execution_status: executing
  await FinancialService.approveAccountTransfer(transfer3.id, adminUserId);
  const walletPreFail = await FinancialService.getOrCreateWallet(clientUserId, 'USD');
  assert(walletPreFail.balance === '2250.00', 'Wallet debited $350.00 upon approval -> $2250.00');

  // Now engine reports execution failed (e.g. margin limit, network error)
  const failRes = await FinancialService.failExecution(transfer3.id, adminUserId, {
    failure_reason: 'Trading Engine margin rejection code 4102',
    admin_notes: 'Attempted retry 2 times, rejected by engine',
  });

  assert(failRes.transfer.status === 'failed', 'Transfer status marked failed upon execution failure');
  assert(failRes.transfer.execution_status === 'failed', 'Execution status marked failed');
  assert(failRes.wallet.balance === '2600.00', 'Compensating refund restored wallet balance to $2600.00');
  assert(failRes.transaction?.type === 'adjustment_credit', 'Compensating ledger entry adjustment_credit created');
  assert(
    failRes.transaction?.description.includes('Compensating refund'),
    'Ledger description documents compensating refund'
  );

  // 9. Trading Account -> Wallet Lifecycle (Phase 1 & 2: No premature credit)
  console.log('\n--- [Phase 9] Trading -> Wallet Transfer Flow (No Premature Credit) ---');
  const transferT2W = await FinancialService.createAccountTransfer(clientUserId, {
    trading_account_id: tradingAcc.id,
    direction: 'trading_to_wallet',
    amount: '150.00',
    currency: 'USD',
    client_notes: 'Transfer trading profits back to cash wallet',
  });

  assert(transferT2W.status === 'pending', 'T2W transfer created in pending state');
  const walletCheckT2W1 = await FinancialService.getOrCreateWallet(clientUserId, 'USD');
  assert(walletCheckT2W1.balance === '2600.00', 'Wallet balance untouched on T2W request creation');

  // Admin approves T2W
  const approveT2WRes = await FinancialService.approveAccountTransfer(transferT2W.id, adminUserId, {
    admin_notes: 'Approved for deduction on engine',
  });
  assert(approveT2WRes.transfer.status === 'approved', 'T2W transfer status approved');
  assert(approveT2WRes.transfer.execution_status === 'executing', 'T2W execution status executing');

  // CRITICAL INVARIANT: Wallet is STILL NOT credited upon approval for trading_to_wallet!
  const walletCheckT2W2 = await FinancialService.getOrCreateWallet(clientUserId, 'USD');
  assert(
    walletCheckT2W2.balance === '2600.00',
    'CRITICAL: Wallet balance NOT credited upon T2W approval (Awaiting confirmed engine debit)'
  );

  // Engine confirms debit: confirmExecution is called
  const confirmT2WRes = await FinancialService.confirmExecution(transferT2W.id, adminUserId, {
    external_transaction_id: 'TE-MT5-WTH-449102',
    execution_notes: 'Engine debited 150.00 from position free margin',
  });

  assert(confirmT2WRes.transfer.status === 'completed', 'T2W transfer status completed');
  assert(confirmT2WRes.transfer.execution_status === 'confirmed', 'T2W execution status confirmed');
  assert(confirmT2WRes.wallet.balance === '2750.00', 'Wallet atomically credited $150.00 -> $2750.00 upon confirmed execution');
  assert(confirmT2WRes.transaction?.type === 'transfer_in', 'Ledger transaction transfer_in recorded');
  assert(confirmT2WRes.transaction?.balance_after === '2750.00', 'Ledger balance_after is 2750.00');

  // 10. Idempotency & Collision Rejection
  console.log('\n--- [Phase 10] Idempotency & Concurrency Invariants ---');
  const idempotencyKey = 'idemp-tx-key-' + Date.now();
  const trfIdemp1 = await FinancialService.createAccountTransfer(clientUserId, {
    trading_account_id: tradingAcc.id,
    direction: 'wallet_to_trading',
    amount: '100.00',
    currency: 'USD',
    idempotency_key: idempotencyKey,
  });

  // Replaying identical payload with same idempotency_key returns identical transfer
  const trfIdemp2 = await FinancialService.createAccountTransfer(clientUserId, {
    trading_account_id: tradingAcc.id,
    direction: 'wallet_to_trading',
    amount: '100.00',
    currency: 'USD',
    idempotency_key: idempotencyKey,
  });
  assert(trfIdemp1.id === trfIdemp2.id, 'Idempotent replay returns same transfer record without double charge');

  // Conflicting payload with same idempotency key must reject
  let collisionThrew = false;
  try {
    await FinancialService.createAccountTransfer(clientUserId, {
      trading_account_id: tradingAcc.id,
      direction: 'wallet_to_trading',
      amount: '999.00', // Conflicting amount!
      currency: 'USD',
      idempotency_key: idempotencyKey,
    });
  } catch (err: any) {
    collisionThrew = true;
    assert(err.message.includes('Idempotency key collision'), 'Conflicting idempotency payload rejected with 409 collision error');
  }
  assert(collisionThrew, 'Idempotency collision was rejected');

  // Double approval prevention
  let doubleApproveThrew = false;
  try {
    await FinancialService.approveAccountTransfer(transfer2.id, adminUserId);
  } catch (err: any) {
    doubleApproveThrew = true;
    assert(err.message.includes('Only pending transfers can be approved'), 'Already processed transfer cannot be approved again');
  }
  assert(doubleApproveThrew, 'Double approval was strictly rejected');

  // Negative balance protection
  let overdrawThrew = false;
  try {
    await FinancialService.createAccountTransfer(clientUserId, {
      trading_account_id: tradingAcc.id,
      direction: 'wallet_to_trading',
      amount: '999999.00', // Exceeds available balance
      currency: 'USD',
    });
  } catch (err: any) {
    overdrawThrew = true;
    assert(err.message.includes('Insufficient wallet balance'), 'Overdraw request strictly rejected');
  }
  assert(overdrawThrew, 'Insufficient funds transfer was rejected');

  // 11. Audit Trail Verification
  console.log('\n--- [Phase 11] Comprehensive Financial Audit Trail ---');
  const auditLogs = inMemoryDb.auditLogs;
  assert(auditLogs.length > 5, 'Multiple financial audit log records created');
  const actions = auditLogs.map((a) => a.action);
  assert(actions.includes('TRANSFER_REQUEST_CREATED'), 'Audit log contains TRANSFER_REQUEST_CREATED');
  assert(actions.includes('TRANSFER_APPROVED'), 'Audit log contains TRANSFER_APPROVED');
  assert(actions.includes('TRANSFER_EXECUTION_CONFIRMED'), 'Audit log contains TRANSFER_EXECUTION_CONFIRMED');
  assert(actions.includes('TRANSFER_EXECUTION_FAILED'), 'Audit log contains TRANSFER_EXECUTION_FAILED');
  assert(actions.includes('TRANSFER_CANCELLED'), 'Audit log contains TRANSFER_CANCELLED');

  // Ensure no password or token leaked in audit details
  const auditDetailsString = JSON.stringify(auditLogs.map((a) => a.details));
  assert(!auditDetailsString.includes('password'), 'Audit trail strictly free of passwords');
  assert(!auditDetailsString.includes('secret'), 'Audit trail strictly free of secrets');

  console.log('\n=============================================================================');
  console.log(`🎉 ALL ${passedTests} / ${totalTests} STEP 2 TESTS PASSED PERFECTLY!`);
  console.log('=============================================================================');
}

runStep2TestSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
