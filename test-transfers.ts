process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';

/**
 * Test Suite: Wallet <-> Trading Account Transfers & Payment Method Integration
 * Validates:
 * 1. Payment method selection & manual payment handling in deposits
 * 2. Wallet -> Trading Account transfer request (pending, no premature balance change)
 * 3. Trading Account -> Wallet transfer request (pending, no premature balance change)
 * 4. Admin review, approval, and rejection workflows
 * 5. Atomic ledger entries (transfer_in, transfer_out) and wallet balance updates
 * 6. IDOR protections and RBAC guards
 */

import { handler } from './netlify/functions/api';
import { inMemoryDb } from './netlify/functions/db/client';
import { FinancialService } from './netlify/functions/services/financial.service';
import { TradingAccountService } from './netlify/functions/services/trading-account.service';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function callApi(options: {
  path: string;
  method?: string;
  body?: any;
  token?: string | null;
  query?: Record<string, string>;
}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const event: any = {
    path: options.path,
    httpMethod: options.method || 'GET',
    headers,
    queryStringParameters: options.query || null,
    body: options.body ? JSON.stringify(options.body) : null,
  };

  const response: any = await handler(event, {} as any);
  let parsedBody: any = null;
  try {
    parsedBody = response?.body ? JSON.parse(response.body) : null;
  } catch {
    parsedBody = response?.body;
  }

  return {
    status: response?.statusCode || 500,
    body: parsedBody,
  };
}

async function run() {
  console.log('🧪 Starting Wallet <-> Trading Account Transfer & Payment Method Test Suite...\n');

  inMemoryDb.clear();

  // 1. Setup Admin and 2 Clients
  console.log('[1] User & Account Setup:');
  const adminRes = await callApi({
    path: '/api/auth/setup-admin',
    method: 'POST',
    body: {
      email: 'chief_admin@broker.com',
      password: 'AdminPassword@123',
      first_name: 'Chief',
      last_name: 'Admin',
      country: 'GB',
      setup_secret: process.env.ADMIN_SETUP_SECRET || 'forex-crm-secure-admin-setup-secret-2026',
    },
  });
  assert(adminRes.status === 201, 'Admin bootstrap succeeded');
  const adminToken = adminRes.body.data.token;
  const adminId = adminRes.body.data.user.id;

  const client1Res = await callApi({
    path: '/api/auth/register',
    method: 'POST',
    body: {
      email: 'trader1@client.com',
      password: 'TraderPassword@123',
      first_name: 'John',
      last_name: 'Trader',
      country: 'US',
      preferred_currency: 'USD',
    },
  });
  assert(client1Res.status === 201, 'Client 1 registered');
  const client1Token = client1Res.body.data.token;
  const client1Id = client1Res.body.data.user.id;

  const client2Res = await callApi({
    path: '/api/auth/register',
    method: 'POST',
    body: {
      email: 'trader2@client.com',
      password: 'TraderPassword@123',
      first_name: 'Bob',
      last_name: 'Trader',
      country: 'US',
      preferred_currency: 'USD',
    },
  });
  assert(client2Res.status === 201, 'Client 2 registered');
  const client2Token = client2Res.body.data.token;
  const client2Id = client2Res.body.data.user.id;

  // Client 1 registers a Live MT5 account
  const liveAccReg = await callApi({
    path: '/api/trading-accounts/register',
    method: 'POST',
    token: client1Token,
    body: {
      platform: 'MT5',
      account_type: 'standard',
      currency: 'USD',
      leverage: '1:100',
      nickname: 'Main Live MT5',
      is_demo: false,
      server_name: 'Live-Server-01',
    },
  });
  assert(liveAccReg.status === 201, 'Client 1 registered live account');
  const liveAccountId = liveAccReg.body.data.id;

  // Admin approves the live account
  const approveAccRes = await callApi({
    path: `/api/admin/trading-accounts/${liveAccountId}/approve`,
    method: 'POST',
    token: adminToken,
    body: {
      account_number: '5501001',
      server_name: 'Live-Server-01',
    },
  });
  assert(approveAccRes.status === 200, 'Admin approved live trading account');
  const client1LiveAccount = await TradingAccountService.findRawAccount(liveAccountId);
  assert(client1LiveAccount?.status === 'active', 'Client 1 live trading account is active');
  assert(client1LiveAccount?.balance === '0.00', 'Initial live trading account balance is 0.00');

  // 2. Deposit with Custom / Selected Payment Method
  console.log('\n[2] Deposit with Payment Method:');
  const depositRes = await callApi({
    path: '/api/financial/deposits',
    method: 'POST',
    token: client1Token,
    body: {
      amount: '1000.00',
      currency: 'USD',
      payment_method_id: 'manual_other',
      payment_method_name: 'Bank Wire Swift Transfer',
      client_notes: 'Deposit via Chase Wire',
    },
  });
  assert(depositRes.status === 201, 'Deposit created with payment method');
  const depositData = depositRes.body.data;
  assert(depositData.payment_method_name === 'Bank Wire Swift Transfer', 'Payment method name recorded correctly');
  assert(depositData.status === 'pending', 'Deposit is pending admin approval');

  // Admin approves deposit
  const approveDepositRes = await callApi({
    path: `/api/financial/admin/deposits/${depositData.id}/approve`,
    method: 'POST',
    token: adminToken,
    body: {
      admin_notes: 'Wire received in broker custody account',
    },
  });
  assert(approveDepositRes.status === 200, 'Admin approved deposit');
  const walletAfterDeposit = await FinancialService.getOrCreateWallet(client1Id, 'USD');
  assert(walletAfterDeposit.balance === '1000.00', 'Wallet balance credited to 1000.00');
  assert(walletAfterDeposit.available_balance === '1000.00', 'Wallet available balance is 1000.00');

  // 3. Wallet -> Trading Account Transfer Request Workflow
  console.log('\n[3] Wallet -> Trading Account Transfer Request Workflow:');
  // Attempt transfer with excessive amount (insufficient funds)
  const excessiveTransferRes = await callApi({
    path: '/api/financial/transfers',
    method: 'POST',
    token: client1Token,
    body: {
      trading_account_id: liveAccountId,
      direction: 'wallet_to_trading',
      amount: '5000.00',
      currency: 'USD',
      client_notes: 'Transfer too much',
    },
  });
  assert(excessiveTransferRes.status === 400, 'Rejects transfer exceeding available wallet balance');

  // Valid transfer request: $400.00 from Wallet to Live Trading Account
  const validTransferRes = await callApi({
    path: '/api/financial/transfers',
    method: 'POST',
    token: client1Token,
    body: {
      trading_account_id: liveAccountId,
      direction: 'wallet_to_trading',
      amount: '400.00',
      currency: 'USD',
      client_notes: 'Funding live trading account',
    },
  });
  assert(validTransferRes.status === 201, 'Transfer request created successfully');
  const transfer1 = validTransferRes.body.data;
  assert(transfer1.status === 'pending', 'Transfer is in "pending" status');
  assert(transfer1.reference_no.startsWith('TRF-'), 'Transfer reference number starts with TRF-');
  assert(transfer1.direction === 'wallet_to_trading', 'Transfer direction is wallet_to_trading');

  // CRITICAL: Verify NO funds moved while transfer is pending
  const walletWhilePending = await FinancialService.getOrCreateWallet(client1Id, 'USD');
  const accountWhilePending = await TradingAccountService.findRawAccount(liveAccountId);
  assert(walletWhilePending.balance === '1000.00', 'Wallet balance untouched while transfer pending ($1000.00)');
  assert(accountWhilePending?.balance === '0.00', 'Trading account balance untouched while transfer pending ($0.00)');

  // 4. Admin Review and Approval of Wallet -> Trading Account Transfer
  console.log('\n[4] Admin Approval of Wallet -> Trading Account Transfer:');
  // Regular client cannot approve transfer (RBAC check)
  const clientTryApprove = await callApi({
    path: `/api/financial/admin/transfers/${transfer1.id}/approve`,
    method: 'POST',
    token: client1Token,
    body: { admin_notes: 'Unauthorized approval' },
  });
  assert(clientTryApprove.status === 403, 'Regular client forbidden from approving transfer (403)');

  // Admin approves transfer
  const adminApproveRes = await callApi({
    path: `/api/financial/admin/transfers/${transfer1.id}/approve`,
    method: 'POST',
    token: adminToken,
    body: { admin_notes: 'Transfer approved and booked' },
  });
  assert(adminApproveRes.status === 200, 'Admin successfully approved transfer');
  const approvedTransferData = adminApproveRes.body.data;
  assert(approvedTransferData.transfer.status === 'approved', 'Transfer status updated to approved');

  // Verify atomic balances
  const walletAfterTransfer = await FinancialService.getOrCreateWallet(client1Id, 'USD');
  const accountAfterTransfer = await TradingAccountService.findRawAccount(liveAccountId);
  assert(walletAfterTransfer.balance === '600.00', 'Wallet balance debited to 600.00 (1000 - 400)');
  assert(accountAfterTransfer?.balance === '400.00', 'Trading account balance credited to 400.00 (0 + 400)');

  // Verify immutable ledger entry
  const transactions = await FinancialService.listTransactions({ userId: client1Id });
  const transferTxn = transactions.find((t) => t.reference_id === transfer1.id);
  assert(!!transferTxn, 'Ledger transaction record exists for transfer');
  assert(transferTxn?.type === 'transfer_out', 'Ledger transaction type is transfer_out');
  assert(transferTxn?.amount === '400.00', 'Ledger transaction amount is 400.00');
  assert(transferTxn?.balance_before === '1000.00', 'Ledger tracks wallet balance_before as 1000.00');
  assert(transferTxn?.balance_after === '600.00', 'Ledger tracks wallet balance_after as 600.00');

  // Verify double-approval guard
  const doubleApprove = await callApi({
    path: `/api/financial/admin/transfers/${transfer1.id}/approve`,
    method: 'POST',
    token: adminToken,
    body: { admin_notes: 'Duplicate approval' },
  });
  assert(doubleApprove.status === 400, 'Double-approval blocked: cannot approve already approved transfer');

  // 5. Trading Account -> Wallet Transfer Request Workflow
  console.log('\n[5] Trading Account -> Wallet Transfer Request Workflow:');
  // Attempt transfer exceeding trading account balance
  const excessiveBackRes = await callApi({
    path: '/api/financial/transfers',
    method: 'POST',
    token: client1Token,
    body: {
      trading_account_id: liveAccountId,
      direction: 'trading_to_wallet',
      amount: '800.00',
      currency: 'USD',
      client_notes: 'Too much from trading',
    },
  });
  assert(excessiveBackRes.status === 400, 'Rejects transfer exceeding trading account balance ($400 vs $800)');

  // Valid transfer from Trading Account back to Wallet ($150.00)
  const validBackRes = await callApi({
    path: '/api/financial/transfers',
    method: 'POST',
    token: client1Token,
    body: {
      trading_account_id: liveAccountId,
      direction: 'trading_to_wallet',
      amount: '150.00',
      currency: 'USD',
      client_notes: 'Transfer profit to wallet',
    },
  });
  assert(validBackRes.status === 201, 'Trading to wallet transfer request created');
  const transfer2 = validBackRes.body.data;
  assert(transfer2.status === 'pending', 'Trading to wallet transfer is pending');

  // Balances remain untouched while pending
  const walletPending2 = await FinancialService.getOrCreateWallet(client1Id, 'USD');
  const accountPending2 = await TradingAccountService.findRawAccount(liveAccountId);
  assert(walletPending2.balance === '600.00', 'Wallet balance untouched while pending ($600.00)');
  assert(accountPending2?.balance === '400.00', 'Trading account balance untouched while pending ($400.00)');

  // Admin approves trading -> wallet transfer
  const adminApproveBackRes = await callApi({
    path: `/api/financial/admin/transfers/${transfer2.id}/approve`,
    method: 'POST',
    token: adminToken,
    body: { admin_notes: 'Approved profit withdrawal to wallet' },
  });
  assert(adminApproveBackRes.status === 200, 'Admin approved trading to wallet transfer');

  // Verify atomic balances
  const walletAfterBack = await FinancialService.getOrCreateWallet(client1Id, 'USD');
  const accountAfterBack = await TradingAccountService.findRawAccount(liveAccountId);
  assert(walletAfterBack.balance === '750.00', 'Wallet balance credited to 750.00 (600 + 150)');
  assert(accountAfterBack?.balance === '250.00', 'Trading account debited to 250.00 (400 - 150)');

  // Verify ledger entry for transfer_in
  const transactionsAfter = await FinancialService.listTransactions({ userId: client1Id });
  const transferInTxn = transactionsAfter.find((t) => t.reference_id === transfer2.id);
  assert(!!transferInTxn, 'Ledger transaction record exists for transfer_in');
  assert(transferInTxn?.type === 'transfer_in', 'Ledger transaction type is transfer_in');
  assert(transferInTxn?.balance_before === '600.00', 'Ledger tracks wallet balance_before as 600.00');
  assert(transferInTxn?.balance_after === '750.00', 'Ledger tracks wallet balance_after as 750.00');

  // 6. Admin Rejection Workflow
  console.log('\n[6] Admin Rejection Workflow:');
  const rejectReq = await callApi({
    path: '/api/financial/transfers',
    method: 'POST',
    token: client1Token,
    body: {
      trading_account_id: liveAccountId,
      direction: 'wallet_to_trading',
      amount: '100.00',
      currency: 'USD',
      client_notes: 'Will be rejected',
    },
  });
  const transfer3 = rejectReq.body.data;

  const adminRejectRes = await callApi({
    path: `/api/financial/admin/transfers/${transfer3.id}/reject`,
    method: 'POST',
    token: adminToken,
    body: {
      rejection_reason: 'Account undergoing maintenance',
      admin_notes: 'Temporarily blocked',
    },
  });
  assert(adminRejectRes.status === 200, 'Admin successfully rejected transfer');
  const rejectedTransferData = adminRejectRes.body.data;
  assert(rejectedTransferData.transfer.status === 'rejected', 'Transfer status is rejected');
  assert(rejectedTransferData.transfer.rejection_reason === 'Account undergoing maintenance', 'Rejection reason preserved');

  // Verify NO funds moved on rejection
  const walletAfterReject = await FinancialService.getOrCreateWallet(client1Id, 'USD');
  const accountAfterReject = await TradingAccountService.findRawAccount(liveAccountId);
  assert(walletAfterReject.balance === '750.00', 'Wallet balance unchanged on rejection ($750.00)');
  assert(accountAfterReject?.balance === '250.00', 'Trading account balance unchanged on rejection ($250.00)');

  // 7. Strict IDOR Checks
  console.log('\n[7] IDOR Protections:');
  // Client 2 attempts to transfer from Client 1's trading account
  const idorTransferRes = await callApi({
    path: '/api/financial/transfers',
    method: 'POST',
    token: client2Token,
    body: {
      trading_account_id: liveAccountId,
      direction: 'trading_to_wallet',
      amount: '50.00',
      currency: 'USD',
    },
  });
  assert(
    idorTransferRes.status === 403 || idorTransferRes.status === 404,
    'IDOR Blocked: Client cannot transfer from another client trading account'
  );

  // 8. List Transfers
  console.log('\n[8] List Transfers Workflow:');
  const clientListRes = await callApi({
    path: '/api/financial/transfers',
    method: 'GET',
    token: client1Token,
  });
  assert(clientListRes.status === 200, 'Client lists transfers');
  const clientTransfers = clientListRes.body.data;
  assert(clientTransfers.length === 3, 'Client sees all 3 transfer requests');
  assert(clientTransfers[0].account_number === client1LiveAccount?.account_number, 'Hydrated account number present');

  const adminListRes = await callApi({
    path: '/api/financial/transfers',
    method: 'GET',
    token: adminToken,
  });
  assert(adminListRes.status === 200, 'Admin lists all transfers');
  const allTransfers = adminListRes.body.data;
  assert(allTransfers.length >= 3, 'Admin sees all client transfers across the broker');
  assert(allTransfers[0].user_email === 'trader1@client.com', 'Admin sees hydrated user email');

  console.log(`\n========================================`);
  console.log(`🎉 Transfer & Payment Method Test Suite: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});

