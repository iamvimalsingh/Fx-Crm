process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';

import { FinancialService } from './netlify/functions/services/financial.service';
import { handler as netlifyHandler } from './netlify/functions/api';
import { generateToken } from './netlify/functions/middleware/auth';
import { inMemoryDb, UserRecord } from './netlify/functions/db/client';
import { toDecimal, formatMoney, calculateAvailableBalance } from './netlify/functions/services/financial-math';

async function runFinancialTests() {
  console.log('🧪 Starting Netlify-Native Financial CRM Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    const testAdminUser: UserRecord = {
      id: 'admin-test-uuid-0001',
      email: 'admin.tester@broker.local',
      password_hash: '$2a$10$dummyhashadmin',
      role: 'admin',
      status: 'active',
      first_name: 'Super',
      last_name: 'Admin',
      country: 'US',
      preferred_currency: 'USD',
      created_at: new Date(),
      updated_at: new Date(),
    };
    inMemoryDb.users.set(testAdminUser.email, testAdminUser);
    const adminToken = generateToken(testAdminUser);

    const testClientUser: UserRecord = {
      id: 'client-test-uuid-0001',
      email: 'trader.tester@broker.local',
      password_hash: '$2a$10$dummyhashclient',
      role: 'client',
      status: 'active',
      first_name: 'Forex',
      last_name: 'Trader',
      country: 'GB',
      preferred_currency: 'USD',
      created_at: new Date(),
      updated_at: new Date(),
    };
    inMemoryDb.users.set(testClientUser.email, testClientUser);
    const clientToken = generateToken(testClientUser);

    // -------------------------------------------------------------------------
    // TEST 1: Exact Decimal Arithmetic & Invariants
    // -------------------------------------------------------------------------
    console.log('[1] Exact Decimal-Safe Financial Math:');
    const d1 = toDecimal('0.10');
    const d2 = toDecimal('0.20');
    const sum = d1.plus(d2);
    assert(sum.toFixed(2) === '0.30', '0.10 + 0.20 equals exact 0.30 (no IEEE-754 float drift)');

    const availBal = calculateAvailableBalance('1000.50', '250.00');
    assert(availBal.toFixed(2) === '750.50', 'Available balance calculation: 1000.50 - 250.00 = 750.50');

    try {
      calculateAvailableBalance('100.00', '150.00');
      assert(false, 'Should throw invariant violation if reserved exceeds balance');
    } catch (e: any) {
      assert(e.message.includes('Invariant violation'), 'Rejects negative available balance invariant');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Wallet Provisioning & Initial State
    // -------------------------------------------------------------------------
    console.log('\n[2] Wallet Provisioning:');
    const wallet = await FinancialService.getOrCreateWallet(testClientUser.id, 'USD');
    assert(wallet.balance === '0.00', 'Initial wallet balance is 0.00');
    assert(wallet.reserved_balance === '0.00', 'Initial reserved balance is 0.00');
    assert(wallet.available_balance === '0.00', 'Initial available balance is 0.00');

    // -------------------------------------------------------------------------
    // TEST 3: Deposit Workflow (Client Submit -> Pending -> Admin Approval -> Ledger)
    // -------------------------------------------------------------------------
    console.log('\n[3] Manual Deposit Workflow:');
    const deposit = await FinancialService.createDeposit(testClientUser.id, {
      amount: '500.00',
      currency: 'USD',
      client_notes: 'Wire transfer test #1',
    });

    assert(deposit.status === 'pending', 'Deposit request created with status "pending"');
    assert(deposit.amount === '500.00', 'Deposit amount recorded with exact precision');

    // Wallet balance should NOT have changed yet
    const walletBeforeApproval = await FinancialService.getOrCreateWallet(testClientUser.id, 'USD');
    assert(walletBeforeApproval.balance === '0.00', 'Wallet balance remains unchanged while deposit is pending');

    // Admin approves deposit
    const approveResult = await FinancialService.approveDeposit(deposit.id, testAdminUser.id, {
      admin_notes: 'Bank wire verified in escrow account',
    });

    assert(approveResult.deposit.status === 'approved', 'Deposit status transitioned to "approved"');
    assert(approveResult.wallet.balance === '500.00', 'Wallet balance credited to exact 500.00');
    assert(approveResult.wallet.available_balance === '500.00', 'Available balance updated to 500.00');
    assert(approveResult.transaction.type === 'deposit', 'Immutable ledger transaction type is "deposit"');
    assert(approveResult.transaction.balance_before === '0.00', 'Ledger tracks balance_before as 0.00');
    assert(approveResult.transaction.balance_after === '500.00', 'Ledger tracks balance_after as 500.00');

    // Verify audit log
    const auditLogs = await FinancialService.listAuditLogs({ targetType: 'deposit', targetId: deposit.id });
    assert(auditLogs.length >= 2, 'Audit logs recorded for DEPOSIT_SUBMITTED and DEPOSIT_APPROVED');

    // -------------------------------------------------------------------------
    // TEST 4: Deposit Rejection Workflow
    // -------------------------------------------------------------------------
    console.log('\n[4] Deposit Rejection Workflow:');
    const rejectedDeposit = await FinancialService.createDeposit(testClientUser.id, {
      amount: '300.00',
      currency: 'USD',
      client_notes: 'Unverified transfer',
    });

    const rejectResult = await FinancialService.rejectDeposit(rejectedDeposit.id, testAdminUser.id, {
      rejection_reason: 'Sender name does not match KYC verification',
    });

    assert(rejectResult.status === 'rejected', 'Deposit transitioned to "rejected"');
    assert(rejectResult.rejection_reason === 'Sender name does not match KYC verification', 'Rejection reason stored');

    const walletAfterReject = await FinancialService.getOrCreateWallet(testClientUser.id, 'USD');
    assert(walletAfterReject.balance === '500.00', 'Wallet balance unaffected by rejected deposit');

    // -------------------------------------------------------------------------
    // TEST 5: Withdrawal Workflow (Reserve -> Pending -> Admin Approval -> Deduct)
    // -------------------------------------------------------------------------
    console.log('\n[5] Manual Withdrawal Workflow (with Balance Reservation):');

    // Try to withdraw more than available
    try {
      await FinancialService.createWithdrawal(testClientUser.id, {
        amount: '600.00',
        currency: 'USD',
        payout_details: { bank_name: 'Barclays', account_no: '12345678' },
      });
      assert(false, 'Should prevent withdrawal exceeding available balance');
    } catch (e: any) {
      assert(e.message.includes('Insufficient available funds'), 'Rejects withdrawal exceeding available funds');
    }

    // Submit valid withdrawal of $200.00
    const wthResult = await FinancialService.createWithdrawal(testClientUser.id, {
      amount: '200.00',
      currency: 'USD',
      payout_details: { bank_name: 'Barclays', account_no: '12345678' },
      client_notes: 'Regular profit withdrawal',
    });

    assert(wthResult.withdrawal.status === 'pending', 'Withdrawal created with status "pending"');
    assert(wthResult.wallet.balance === '500.00', 'Wallet total balance remains 500.00 during pending state');
    assert(wthResult.wallet.reserved_balance === '200.00', 'Reserved balance increased to 200.00');
    assert(wthResult.wallet.available_balance === '300.00', 'Available balance immediately reduced to 300.00');
    assert(wthResult.transaction.type === 'withdrawal_reserve', 'Ledger record created for withdrawal_reserve');

    // Cannot withdraw more than new available balance ($300.00)
    try {
      await FinancialService.createWithdrawal(testClientUser.id, {
        amount: '350.00',
        currency: 'USD',
        payout_details: { bank_name: 'Barclays', account_no: '12345678' },
      });
      assert(false, 'Should prevent second withdrawal exceeding newly reserved available balance');
    } catch (e: any) {
      assert(e.message.includes('Insufficient available funds'), 'Correctly protects reserved funds from double-spending');
    }

    // Admin approves withdrawal
    const approveWth = await FinancialService.approveWithdrawal(wthResult.withdrawal.id, testAdminUser.id, {
      admin_notes: 'Dispatched via SEPA clearing system',
    });

    assert(approveWth.withdrawal.status === 'approved', 'Withdrawal status transitioned to "approved"');
    assert(approveWth.wallet.balance === '300.00', 'Wallet balance reduced to 300.00 (500 - 200)');
    assert(approveWth.wallet.reserved_balance === '0.00', 'Reserved balance cleared to 0.00');
    assert(approveWth.wallet.available_balance === '300.00', 'Available balance remains 300.00');
    assert(approveWth.transaction.type === 'withdrawal', 'Ledger transaction type is "withdrawal"');
    assert(approveWth.transaction.balance_before === '500.00', 'Transaction balance_before was 500.00');
    assert(approveWth.transaction.balance_after === '300.00', 'Transaction balance_after is 300.00');

    // -------------------------------------------------------------------------
    // TEST 6: Withdrawal Rejection & Fund Release
    // -------------------------------------------------------------------------
    console.log('\n[6] Withdrawal Rejection & Reserve Release:');
    const wth2 = await FinancialService.createWithdrawal(testClientUser.id, {
      amount: '100.00',
      currency: 'USD',
      payout_details: { crypto_address: '0x123' },
    });

    assert(wth2.wallet.reserved_balance === '100.00', 'Reserved balance set to 100.00');
    assert(wth2.wallet.available_balance === '200.00', 'Available balance reduced to 200.00');

    const rejectWth = await FinancialService.rejectWithdrawal(wth2.withdrawal.id, testAdminUser.id, {
      rejection_reason: 'Invalid crypto destination network',
    });

    assert(rejectWth.withdrawal.status === 'rejected', 'Withdrawal status set to "rejected"');
    assert(rejectWth.wallet.reserved_balance === '0.00', 'Reserved balance released to 0.00');
    assert(rejectWth.wallet.available_balance === '300.00', 'Available balance restored to 300.00');
    assert(rejectWth.transaction.type === 'withdrawal_release', 'Ledger record created for withdrawal_release');

    // -------------------------------------------------------------------------
    // TEST 7: Client Withdrawal Cancellation
    // -------------------------------------------------------------------------
    console.log('\n[7] Client Withdrawal Cancellation:');
    const wth3 = await FinancialService.createWithdrawal(testClientUser.id, {
      amount: '50.00',
      currency: 'USD',
      payout_details: { bank: 'Test' },
    });
    assert(wth3.wallet.reserved_balance === '50.00', 'Reserved balance is 50.00');

    const cancelResult = await FinancialService.cancelWithdrawal(wth3.withdrawal.id, testClientUser.id, false);
    assert(cancelResult.withdrawal.status === 'cancelled', 'Withdrawal cancelled by client');
    assert(cancelResult.wallet.reserved_balance === '0.00', 'Reserved balance restored to 0.00 on cancellation');
    assert(cancelResult.wallet.available_balance === '300.00', 'Available balance restored to 300.00');

    // -------------------------------------------------------------------------
    // TEST 8: Admin Manual Adjustment (Credit and Debit)
    // -------------------------------------------------------------------------
    console.log('\n[8] Admin Manual Adjustments:');
    const creditAdjust = await FinancialService.manualAdjustment(testAdminUser.id, {
      user_id: testClientUser.id,
      type: 'adjustment_credit',
      amount: '150.00',
      description: 'Promotional welcome bonus credit',
    });
    assert(creditAdjust.wallet.balance === '450.00', 'Manual credit increased balance to 450.00');
    assert(creditAdjust.transaction.type === 'adjustment_credit', 'Ledger records adjustment_credit');

    const debitAdjust = await FinancialService.manualAdjustment(testAdminUser.id, {
      user_id: testClientUser.id,
      type: 'adjustment_debit',
      amount: '50.00',
      description: 'Fee reconciliation',
    });
    assert(debitAdjust.wallet.balance === '400.00', 'Manual debit decreased balance to 400.00');
    assert(debitAdjust.transaction.type === 'adjustment_debit', 'Ledger records adjustment_debit');

    // -------------------------------------------------------------------------
    // TEST 9: HTTP Endpoint Authorization & Role Validation
    // -------------------------------------------------------------------------
    console.log('\n[9] HTTP API Authorization & Role Guards:');

    // Unauthorized call to financial endpoint
    const unauthEvent: any = {
      path: '/api/financial/wallet',
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {},
      body: null,
    };
    const unauthRes = await netlifyHandler(unauthEvent, {} as any);
    assert((unauthRes as any).statusCode === 401, 'Unauthenticated access to /api/financial/wallet returns 401');

    // Client attempting admin-only approval
    const clientApproveEvent: any = {
      path: `/api/financial/admin/deposits/${deposit.id}/approve`,
      httpMethod: 'POST',
      headers: { Authorization: `Bearer ${clientToken}` },
      queryStringParameters: {},
      body: JSON.stringify({ admin_notes: 'Hacker trying to self-approve' }),
    };
    const clientApproveRes = await netlifyHandler(clientApproveEvent, {} as any);
    assert((clientApproveRes as any).statusCode === 403, 'Client forbidden (403) from admin financial operations');

    // Valid authenticated client getting wallet via HTTP
    const clientWalletEvent: any = {
      path: '/api/financial/wallet',
      httpMethod: 'GET',
      headers: { Authorization: `Bearer ${clientToken}` },
      queryStringParameters: {},
      body: null,
    };
    const clientWalletRes = await netlifyHandler(clientWalletEvent, {} as any);
    assert((clientWalletRes as any).statusCode === 200, 'Client successfully fetches wallet via API');
    const clientWalletBody = JSON.parse((clientWalletRes as any).body);
    assert(clientWalletBody.data.balance === '400.00', 'API returns exact wallet balance 400.00');

    // -------------------------------------------------------------------------
    // TEST 10: Immutable Ledger Integrity
    // -------------------------------------------------------------------------
    console.log('\n[10] Ledger Audit & Immutability:');
    const allTxns = await FinancialService.listTransactions({ userId: testClientUser.id });
    assert(allTxns.length >= 6, `Ledger contains complete history (${allTxns.length} records)`);
    const allHaveRefs = allTxns.every((t) => Boolean(t.transaction_no && t.balance_before && t.balance_after));
    assert(allHaveRefs, 'Every transaction has transaction_no, balance_before, and balance_after');

    console.log(`\n========================================`);
    console.log(`🎉 Financial Module Tests Complete: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

runFinancialTests();
