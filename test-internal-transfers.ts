process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';

import { FinancialService } from './netlify/functions/services/financial.service';
import { TradingAccountService } from './netlify/functions/services/trading-account.service';
import { handler as netlifyHandler } from './netlify/functions/api';
import { generateToken } from './netlify/functions/middleware/auth';
import { inMemoryDb, UserRecord } from './netlify/functions/db/client';
import { toDecimal, formatMoney } from './netlify/functions/services/financial-math';

async function runForensicVerification() {
  console.log('🔍 Starting PROMPT 5002-A Internal Transfer Forensic Verification...\n');
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
    // -------------------------------------------------------------------------
    // Setup Users
    // -------------------------------------------------------------------------
    const adminUser: UserRecord = {
      id: 'admin-forensic-uuid-001',
      email: 'admin.forensic@broker.local',
      password_hash: '$2a$10$hashedAdminPassword',
      role: 'admin',
      status: 'active',
      first_name: 'Forensic',
      last_name: 'Admin',
      country: 'US',
      preferred_currency: 'USD',
      created_at: new Date(),
      updated_at: new Date(),
    };
    inMemoryDb.users.set(adminUser.email, adminUser);
    const adminToken = generateToken(adminUser);

    const clientA: UserRecord = {
      id: 'client-forensic-uuid-001',
      email: 'trader.a@broker.local',
      password_hash: '$2a$10$hashedClientPassword',
      role: 'client',
      status: 'active',
      first_name: 'Alice',
      last_name: 'Trader',
      country: 'GB',
      preferred_currency: 'USD',
      created_at: new Date(),
      updated_at: new Date(),
    };
    inMemoryDb.users.set(clientA.email, clientA);
    const clientAToken = generateToken(clientA);

    const clientB: UserRecord = {
      id: 'client-forensic-uuid-002',
      email: 'trader.b@broker.local',
      password_hash: '$2a$10$hashedClientBPassword',
      role: 'client',
      status: 'active',
      first_name: 'Bob',
      last_name: 'Trader',
      country: 'DE',
      preferred_currency: 'USD',
      created_at: new Date(),
      updated_at: new Date(),
    };
    inMemoryDb.users.set(clientB.email, clientB);

    // Setup initial wallet for client A with $1,000.00
    const walletA = await FinancialService.getOrCreateWallet(clientA.id, 'USD');
    walletA.balance = '1000.00';
    walletA.reserved_balance = '0.00';
    inMemoryDb.wallets.set(walletA.id, walletA);
    inMemoryDb.wallets.set(`${clientA.id}_USD`, walletA);

    // Register active trading account for client A with $250.00 initial balance
    const tradingAccA = await TradingAccountService.registerAccount(clientA.id, {
      platform: 'MT5',
      account_type: 'raw_spread',
      currency: 'USD',
      leverage: '1:200',
      nickname: 'Forensic Live A',
      is_demo: false,
    });
    // Admin activates trading account with $250.00 balance
    await TradingAccountService.approveAccount(adminUser.id, tradingAccA.id, {
      account_number: '55001122',
      server_name: 'MetaQuotes-Live',
    });
    await TradingAccountService.updateAccountBalance(tradingAccA.id, '250.00');

    // Register trading account for client B
    const tradingAccB = await TradingAccountService.registerAccount(clientB.id, {
      platform: 'MT4',
      account_type: 'standard',
      currency: 'USD',
      leverage: '1:100',
      is_demo: false,
    });
    await TradingAccountService.approveAccount(adminUser.id, tradingAccB.id, {
      account_number: '44009988',
      server_name: 'MetaQuotes-Live2',
    });
    await TradingAccountService.updateAccountBalance(tradingAccB.id, '100.00');

    // =========================================================================
    // SECTION 1: WALLET -> TRADING ACCOUNT LIFECYCLE FORENSIC TRACE
    // =========================================================================
    console.log('[1] Forensic Trace: Wallet -> Trading Account:');

    // 1.1 Request Creation
    const initialWalletBal = (await FinancialService.getOrCreateWallet(clientA.id, 'USD')).balance;
    const initialAccBal = (await TradingAccountService.findRawAccount(tradingAccA.id))?.balance;
    assert(initialWalletBal === '1000.00', 'Initial wallet balance is $1000.00');
    assert(initialAccBal === '250.00', 'Initial trading account balance is $250.00');

    const transferW2T = await FinancialService.createAccountTransfer(clientA.id, {
      trading_account_id: tradingAccA.id,
      direction: 'wallet_to_trading',
      amount: '300.00',
      client_notes: 'Transfer to live margin',
    });

    assert(transferW2T.status === 'pending', 'Transfer request created with pending state');
    assert(transferW2T.amount === '300.00', 'Transfer amount is exactly 300.00');
    assert(transferW2T.direction === 'wallet_to_trading', 'Direction is wallet_to_trading');

    // Verify NO balance change occurred on request creation
    const walletAfterCreate = await FinancialService.getOrCreateWallet(clientA.id, 'USD');
    const accAfterCreate = await TradingAccountService.findRawAccount(tradingAccA.id);
    assert(walletAfterCreate.balance === '1000.00', 'Wallet balance untouched after request creation (no premature debit)');
    assert(accAfterCreate?.balance === '250.00', 'Trading account balance untouched after request creation (no premature credit)');

    // Verify Audit log was created
    const auditLogs1 = inMemoryDb.auditLogs.filter((a) => a.entity_id === transferW2T.id);
    assert(auditLogs1.length === 1 && auditLogs1[0].action === 'TRANSFER_REQUEST_CREATED', 'Audit log TRANSFER_REQUEST_CREATED logged');
    assert(!JSON.stringify(auditLogs1[0].details).includes('password'), 'Audit log contains no secrets or passwords');

    // 1.2 Admin Approval
    const approvalRes = await FinancialService.approveAccountTransfer(transferW2T.id, adminUser.id, {
      admin_notes: 'Forensically verified & approved',
    });

    assert(approvalRes.transfer.status === 'approved', 'Transfer status transitioned to approved');
    assert(approvalRes.transfer.approved_by === adminUser.id, 'Approved by recorded with admin ID');
    assert(approvalRes.wallet.balance === '700.00', 'Wallet balance debited exactly $300.00 -> $700.00');
    assert(approvalRes.trading_account.balance === '550.00', 'Trading account credited exactly $300.00 -> $550.00');

    // 1.3 Immutable Ledger Entry
    assert(approvalRes.transaction.type === 'transfer_out', 'Ledger transaction type is transfer_out');
    assert(approvalRes.transaction.amount === '300.00', 'Ledger transaction amount is 300.00');
    assert(approvalRes.transaction.balance_before === '1000.00', 'Ledger records correct balance_before: 1000.00');
    assert(approvalRes.transaction.balance_after === '700.00', 'Ledger records correct balance_after: 700.00');
    assert(approvalRes.transaction.reference_id === transferW2T.id, 'Ledger transaction references transfer request ID');

    // 1.4 Audit Log
    const auditLogsApprove = inMemoryDb.auditLogs.filter((a) => a.entity_id === transferW2T.id && a.action === 'TRANSFER_APPROVED');
    assert(auditLogsApprove.length === 1, 'Audit log TRANSFER_APPROVED recorded');

    // 1.5 Double-Approval & Rejection Invariants
    let doubleApproveThrew = false;
    try {
      await FinancialService.approveAccountTransfer(transferW2T.id, adminUser.id);
    } catch (e: any) {
      doubleApproveThrew = true;
      assert(e.message.includes('Only pending transfers can be approved'), 'Double approval correctly rejected');
    }
    assert(doubleApproveThrew, 'Already approved transfer cannot be approved again');

    let rejectApprovedThrew = false;
    try {
      await FinancialService.rejectAccountTransfer(transferW2T.id, adminUser.id, {
        rejection_reason: 'Should fail',
      });
    } catch (e: any) {
      rejectApprovedThrew = true;
      assert(e.message.includes('Only pending transfers can be rejected'), 'Rejecting approved transfer rejected');
    }
    assert(rejectApprovedThrew, 'Already approved transfer cannot be rejected');

    // Balances remained unchanged after attempted double operations
    const walletCheck1 = await FinancialService.getOrCreateWallet(clientA.id, 'USD');
    const accCheck1 = await TradingAccountService.findRawAccount(tradingAccA.id);
    assert(walletCheck1.balance === '700.00', 'Wallet balance still strictly $700.00 (no double debit)');
    assert(accCheck1?.balance === '550.00', 'Trading account balance still strictly $550.00 (no double credit)');

    // =========================================================================
    // SECTION 2: TRADING ACCOUNT -> WALLET LIFECYCLE FORENSIC TRACE
    // =========================================================================
    console.log('\n[2] Forensic Trace: Trading Account -> Wallet:');

    // 2.1 Request Creation
    const transferT2W = await FinancialService.createAccountTransfer(clientA.id, {
      trading_account_id: tradingAccA.id,
      direction: 'trading_to_wallet',
      amount: '150.00',
      client_notes: 'Withdraw profit to wallet',
    });

    assert(transferT2W.status === 'pending', 'T2W transfer created with pending state');

    // Verify balances untouched upon request creation
    const walletCheck2 = await FinancialService.getOrCreateWallet(clientA.id, 'USD');
    const accCheck2 = await TradingAccountService.findRawAccount(tradingAccA.id);
    assert(walletCheck2.balance === '700.00', 'Wallet balance untouched upon T2W creation');
    assert(accCheck2?.balance === '550.00', 'Trading account balance untouched upon T2W creation');

    // 2.2 Admin Approval
    const approvalT2W = await FinancialService.approveAccountTransfer(transferT2W.id, adminUser.id, {
      admin_notes: 'Profit withdrawal approved',
    });

    assert(approvalT2W.transfer.status === 'approved', 'T2W transfer status is approved');
    assert(approvalT2W.trading_account.balance === '400.00', 'Trading account debited $150.00 -> $400.00');
    assert(approvalT2W.wallet.balance === '850.00', 'Wallet credited $150.00 -> $850.00');

    // 2.3 Ledger Transaction Record
    assert(approvalT2W.transaction.type === 'transfer_in', 'Ledger transaction type is transfer_in');
    assert(approvalT2W.transaction.balance_before === '700.00', 'Ledger records correct balance_before: 700.00');
    assert(approvalT2W.transaction.balance_after === '850.00', 'Ledger records correct balance_after: 850.00');

    // =========================================================================
    // SECTION 3: REJECTION WORKFLOW FORENSIC TRACE
    // =========================================================================
    console.log('\n[3] Forensic Trace: Transfer Rejection:');

    const transferToReject = await FinancialService.createAccountTransfer(clientA.id, {
      trading_account_id: tradingAccA.id,
      direction: 'wallet_to_trading',
      amount: '200.00',
      client_notes: 'To be rejected',
    });

    const walletBeforeRej = (await FinancialService.getOrCreateWallet(clientA.id, 'USD')).balance;
    const accBeforeRej = (await TradingAccountService.findRawAccount(tradingAccA.id))?.balance;

    const rejectionRes = await FinancialService.rejectAccountTransfer(transferToReject.id, adminUser.id, {
      rejection_reason: 'Account undergoing risk compliance check',
      admin_notes: 'Flagged for review',
    });

    assert(rejectionRes.transfer.status === 'rejected', 'Transfer status transitioned to rejected');
    assert(rejectionRes.transfer.rejection_reason === 'Account undergoing risk compliance check', 'Rejection reason persisted');
    assert(rejectionRes.transfer.rejected_by === adminUser.id, 'Rejected by recorded with admin ID');

    // Verify balances did NOT move at all
    const walletAfterRej = (await FinancialService.getOrCreateWallet(clientA.id, 'USD')).balance;
    const accAfterRej = (await TradingAccountService.findRawAccount(tradingAccA.id))?.balance;
    assert(walletAfterRej === walletBeforeRej, 'Wallet balance completely unchanged on rejection');
    assert(accAfterRej === accBeforeRej, 'Trading account balance completely unchanged on rejection');

    // Verify rejection audit log
    const rejAudit = inMemoryDb.auditLogs.filter((a) => a.entity_id === transferToReject.id && a.action === 'TRANSFER_REJECTED');
    assert(rejAudit.length === 1, 'TRANSFER_REJECTED audit record logged');

    // Verify already rejected cannot be approved or rejected again
    let approveRejThrew = false;
    try {
      await FinancialService.approveAccountTransfer(transferToReject.id, adminUser.id);
    } catch (e: any) {
      approveRejThrew = true;
      assert(e.message.includes('Only pending transfers can be approved'), 'Cannot approve rejected transfer');
    }
    assert(approveRejThrew, 'Already rejected transfer blocked from approval');

    // =========================================================================
    // SECTION 4: INSUFFICIENT BALANCE & IDOR SECURITY CHECKS
    // =========================================================================
    console.log('\n[4] Forensic Trace: Balance Invariants & IDOR Security:');

    // 4.1 Insufficient wallet balance at request creation
    let insuffWalletThrew = false;
    try {
      await FinancialService.createAccountTransfer(clientA.id, {
        trading_account_id: tradingAccA.id,
        direction: 'wallet_to_trading',
        amount: '999999.00',
      });
    } catch (e: any) {
      insuffWalletThrew = true;
      assert(e.message.includes('Insufficient wallet balance'), 'Rejects transfer exceeding wallet available balance');
    }
    assert(insuffWalletThrew, 'Request creation enforces wallet balance pre-flight check');

    // 4.2 Insufficient trading balance at request creation
    let insuffAccThrew = false;
    try {
      await FinancialService.createAccountTransfer(clientA.id, {
        trading_account_id: tradingAccA.id,
        direction: 'trading_to_wallet',
        amount: '999999.00',
      });
    } catch (e: any) {
      insuffAccThrew = true;
      assert(e.message.includes('Insufficient trading account balance'), 'Rejects transfer exceeding trading account balance');
    }
    assert(insuffAccThrew, 'Request creation enforces trading account balance pre-flight check');

    // 4.3 IDOR: Client A trying to transfer into Client B's trading account
    let idorThrew = false;
    try {
      await FinancialService.createAccountTransfer(clientA.id, {
        trading_account_id: tradingAccB.id,
        direction: 'wallet_to_trading',
        amount: '50.00',
      });
    } catch (e: any) {
      idorThrew = true;
      assert(
        e.message.includes('Access forbidden') || e.message.includes('permission') || e.message.includes('not found'),
        'IDOR attempt blocked: forbidden trading account access'
      );
    }
    assert(idorThrew, 'Client cannot initiate transfer using an unowned trading account (Strict IDOR enforced)');

    // 4.4 Non-positive amount rejected
    let nonPosThrew = false;
    try {
      await FinancialService.createAccountTransfer(clientA.id, {
        trading_account_id: tradingAccA.id,
        direction: 'wallet_to_trading',
        amount: '-50.00',
      });
    } catch (e: any) {
      nonPosThrew = true;
    }
    assert(nonPosThrew, 'Negative transfer amount rejected');

    let zeroThrew = false;
    try {
      await FinancialService.createAccountTransfer(clientA.id, {
        trading_account_id: tradingAccA.id,
        direction: 'wallet_to_trading',
        amount: '0.00',
      });
    } catch (e: any) {
      zeroThrew = true;
    }
    assert(zeroThrew, 'Zero transfer amount rejected');

    // 4.5 Exact Decimal arithmetic with fractional cents
    const preciseTransfer = await FinancialService.createAccountTransfer(clientA.id, {
      trading_account_id: tradingAccA.id,
      direction: 'wallet_to_trading',
      amount: '123.45',
    });
    const preciseApproval = await FinancialService.approveAccountTransfer(preciseTransfer.id, adminUser.id);
    // Wallet was 850.00, 850.00 - 123.45 = 726.55
    assert(preciseApproval.wallet.balance === '726.55', 'Exact decimal calculation on wallet: 850.00 - 123.45 = 726.55');
    // Account was 400.00, 400.00 + 123.45 = 523.45
    assert(preciseApproval.trading_account.balance === '523.45', 'Exact decimal calculation on trading account: 400.00 + 123.45 = 523.45');

    // =========================================================================
    // SECTION 5: PAYMENT METHOD & MANUAL DEPOSIT VERIFICATION
    // =========================================================================
    console.log('\n[5] Forensic Trace: Payment Method & Manual Deposit Verification:');

    // 5.1 Manual custom payment rail deposit
    const manualDeposit = await FinancialService.createDeposit(clientA.id, {
      amount: '350.00',
      payment_method_id: 'custom_manual',
      payment_method_name: 'Wire Transfer - Barclays London',
      currency: 'USD',
      client_notes: 'Proof ref #BARC-998811',
    });

    assert(manualDeposit.status === 'pending', 'Manual deposit created with pending state');
    assert(manualDeposit.payment_method_name === 'Wire Transfer - Barclays London', 'Custom manual payment method name persisted exactly');
    assert(manualDeposit.amount === '350.00', 'Deposit amount recorded with exact precision');

    // 5.2 Admin approves deposit
    const approvedDep = await FinancialService.approveDeposit(manualDeposit.id, adminUser.id, {
      admin_notes: 'Funds cleared in Barclays account',
    });

    assert(approvedDep.deposit.status === 'approved', 'Deposit marked as approved');
    assert(approvedDep.transaction.description.includes('Wire Transfer - Barclays London'), 'Transaction description preserves manual payment method name');
    // Wallet was 726.55 + 350.00 = 1076.55
    assert(approvedDep.wallet.balance === '1076.55', 'Wallet balance credited with exact decimal precision: 726.55 + 350.00 = 1076.55');

    // =========================================================================
    // SECTION 6: HTTP ENDPOINT & ROLE GUARD TESTS
    // =========================================================================
    console.log('\n[6] Forensic Trace: HTTP Endpoints & Role Guards:');

    // Client cannot approve transfers via HTTP
    const unauthorizedApprovalEvent: any = {
      path: `/api/financial/admin/transfers/${preciseTransfer.id}/approve`,
      httpMethod: 'POST',
      headers: { Authorization: `Bearer ${clientAToken}` },
      queryStringParameters: {},
      body: JSON.stringify({ admin_notes: 'Client attempting self-approval' }),
    };
    const unauthorizedRes = await netlifyHandler(unauthorizedApprovalEvent, {} as any);
    assert((unauthorizedRes as any).statusCode === 403, 'Client forbidden (403) from approving account transfers');

    // Client can fetch their own transfers via HTTP
    const clientListEvent: any = {
      path: '/api/financial/transfers',
      httpMethod: 'GET',
      headers: { Authorization: `Bearer ${clientAToken}` },
      queryStringParameters: {},
      body: null,
    };
    const clientListRes = await netlifyHandler(clientListEvent, {} as any);
    assert((clientListRes as any).statusCode === 200, 'Client can fetch account transfers via /api/financial/transfers');
    const clientListBody = JSON.parse((clientListRes as any).body);
    assert(Array.isArray(clientListBody.data) && clientListBody.data.length >= 3, 'Transfers list returned array of transfer records');

    console.log(`\n=============================================================================`);
    console.log(`🎉 PROMPT 5002-A Forensic Verification Complete: ${passed} passed, ${failed} failed`);
    console.log(`=============================================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('Fatal forensic verification error:', error);
    process.exit(1);
  }
}

runForensicVerification();
