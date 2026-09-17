process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';

import { AuthService } from './netlify/functions/services/auth.service';
import { TradingAccountService } from './netlify/functions/services/trading-account.service';
import { FinancialService } from './netlify/functions/services/financial.service';
import { inMemoryDb } from './netlify/functions/db/client';

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

async function runPrompt5003bTests() {
  console.log('\n=============================================================================');
  console.log('🧪 Starting PROMPT 5003-B Targeted Verification Suite...');
  console.log('=============================================================================');

  // Initialize Admin
  const adminResult = await AuthService.register({
    email: 'superadmin.5003b@broker.com',
    password: 'Password123!@#',
    first_name: 'Super',
    last_name: 'Admin',
    country: 'US',
    preferred_currency: 'USD',
  });
  const adminId = adminResult.user.id;
  const adminRecord = inMemoryDb.users.get('superadmin.5003b@broker.com');
  if (adminRecord) {
    adminRecord.role = 'admin';
  }

  // ===========================================================================
  // 1. ADMIN CLIENT DELETION & ARCHIVAL/RETENTION RULES
  // ===========================================================================
  console.log('\n[1] Admin Client Deletion & Archival Verification:');

  // 1.1 Non-transacting client (clean deletion)
  const cleanClientResult = await AuthService.register({
    email: 'clean.client@test.com',
    password: 'Password123!@#',
    first_name: 'Clean',
    last_name: 'Client',
    country: 'US',
    preferred_currency: 'USD',
  });
  const cleanClientId = cleanClientResult.user.id;

  // Self deletion prevention
  try {
    await AuthService.deleteClient(adminId, adminId);
    assert(false, 'Admin should not be able to delete their own account');
  } catch (err: any) {
    assert(err.message.includes('own profile'), 'Blocked administrator self-deletion');
  }

  // Delete clean client
  const deleteCleanRes = await AuthService.deleteClient(adminId, cleanClientId);
  assert(deleteCleanRes.success === true, 'Clean client deleted successfully');
  assert(deleteCleanRes.action === 'deleted', 'Action is recorded as "deleted" for zero-history client');
  const userCheckClean = inMemoryDb.users.get('clean.client@test.com');
  assert(!userCheckClean, 'Clean client user record removed from inMemoryDb');

  // 1.2 Transacting client (archival/deactivation retention rule)
  const transactingClientResult = await AuthService.register({
    email: 'transacting.client@test.com',
    password: 'Password123!@#',
    first_name: 'Transacting',
    last_name: 'Client',
    country: 'US',
    preferred_currency: 'USD',
  });
  const transactingClientId = transactingClientResult.user.id;

  // Deposit funds to create financial history
  const dep = await FinancialService.createDeposit(transactingClientId, {
    amount: '500.00',
    currency: 'USD',
  });
  await FinancialService.approveDeposit(dep.id, adminId, { admin_notes: 'Test deposit' });

  // Attempt delete while wallet has active balance ($500.00) -> MUST FAIL
  try {
    await AuthService.deleteClient(adminId, transactingClientId);
    assert(false, 'Should block deleting client with active wallet balance');
  } catch (err: any) {
    assert(err.message.includes('active wallet balance'), 'Blocked deleting client with active balance');
  }

  // Settle balance down to 0 via manual debit adjustment
  await FinancialService.manualAdjustment(adminId, {
    user_id: transactingClientId,
    type: 'adjustment_debit',
    amount: '500.00',
    description: 'Settlement for account closure test',
  });

  // Now delete transacting client -> MUST deactivate & retain ledger for compliance
  const deactivateRes = await AuthService.deleteClient(adminId, transactingClientId);
  assert(deactivateRes.success === true, 'Transacting client handled safely');
  assert(deactivateRes.action === 'deactivated', 'Transacting client action is "deactivated" to retain audit history');
  const transactingUser = Array.from(inMemoryDb.users.values()).find((u) => u.id === transactingClientId);
  assert(transactingUser !== undefined, 'User record retained in database for regulatory audit');
  assert(transactingUser?.status === 'suspended', 'User status transitioned to suspended');

  // Verify financial transactions are NOT deleted
  const clientTxCount = inMemoryDb.transactions.filter((tx) => tx.user_id === transactingClientId).length;
  assert(clientTxCount > 0, 'Financial transactions strictly retained');

  // ===========================================================================
  // 2. ADMIN TRADING-ACCOUNT DELETION & ARCHIVAL RULES
  // ===========================================================================
  console.log('\n[2] Admin Trading Account Deletion & Archival Verification:');

  const clientForAccount = await AuthService.register({
    email: 'account.owner@test.com',
    password: 'Password123!@#',
    first_name: 'Account',
    last_name: 'Owner',
    country: 'US',
    preferred_currency: 'USD',
  });
  const accountOwnerId = clientForAccount.user.id;

  // Clean account
  const cleanAccount = await TradingAccountService.registerAccount(accountOwnerId, {
    platform: 'MT5',
    currency: 'USD',
    leverage: '1:100',
    account_type: 'standard',
    is_demo: false,
  });

  // Delete clean account
  const deleteAccountRes = await TradingAccountService.deleteAccountAdmin(adminId, cleanAccount.id);
  assert(deleteAccountRes.success === true, 'Clean trading account delete executed');
  assert(deleteAccountRes.action === 'deleted', 'Clean account hard deleted');
  assert(!inMemoryDb.tradingAccounts.has(cleanAccount.id), 'Trading account record removed from memory');

  // Account with balance
  const fundedAccount = await TradingAccountService.registerAccount(accountOwnerId, {
    platform: 'MT5',
    currency: 'USD',
    leverage: '1:100',
    account_type: 'standard',
    is_demo: false,
  });
  await TradingAccountService.approveAccount(adminId, fundedAccount.id, {
    account_number: '208888',
  });
  await TradingAccountService.updateAccountBalance(fundedAccount.id, '250.00');

  // Attempt delete account with active balance -> MUST FAIL
  try {
    await TradingAccountService.deleteAccountAdmin(adminId, fundedAccount.id);
    assert(false, 'Should block deleting trading account with active balance');
  } catch (err: any) {
    assert(err.message.includes('active balance'), 'Blocked deleting trading account with active balance');
  }

  // Account with transfer history
  await TradingAccountService.updateAccountBalance(fundedAccount.id, '0.00');
  // Seed a transfer record in memory for this account
  inMemoryDb.accountTransfers.set('transfer-1', {
    id: 'transfer-1',
    reference_no: 'TR-1001',
    user_id: accountOwnerId,
    wallet_id: 'wallet-test-01',
    trading_account_id: fundedAccount.id,
    direction: 'wallet_to_trading',
    amount: '100.00',
    currency: 'USD',
    status: 'approved',
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Now delete account with transfer history -> MUST archive rather than destroy history
  const archiveAccountRes = await TradingAccountService.deleteAccountAdmin(adminId, fundedAccount.id);
  assert(archiveAccountRes.success === true, 'Trading account deletion processed');
  assert(archiveAccountRes.action === 'archived', 'Account archived to preserve transfer ledger records');
  const archivedAcc = inMemoryDb.tradingAccounts.get(fundedAccount.id);
  assert(archivedAcc?.status === 'archived', 'Account status updated to archived');

  // ===========================================================================
  // 3. CLIENT 360 TRADING-ACCOUNT MAPPING (ASSIGNMENT)
  // ===========================================================================
  console.log('\n[3] Client 360 Trading Account Mapping Verification:');

  const clientA = await AuthService.register({
    email: 'client.alpha@test.com',
    password: 'Password123!@#',
    first_name: 'Client',
    last_name: 'Alpha',
    country: 'US',
    preferred_currency: 'USD',
  });
  const clientB = await AuthService.register({
    email: 'client.beta@test.com',
    password: 'Password123!@#',
    first_name: 'Client',
    last_name: 'Beta',
    country: 'US',
    preferred_currency: 'USD',
  });

  const assignedAccount = await TradingAccountService.registerAccount(clientA.user.id, {
    platform: 'MT5',
    currency: 'EUR',
    leverage: '1:50',
    account_type: 'raw_spread',
    is_demo: false,
  });

  // Assign from client A to client B
  const assignResult = await TradingAccountService.assignAccountToClientAdmin(
    adminId,
    assignedAccount.id,
    clientB.user.id
  );
  assert(assignResult.account.user_id === clientB.user.id, 'Account user_id updated to target client');
  assert(assignResult.account.owner?.email === 'client.beta@test.com', 'Owner hydrated with new client details');

  // Verify access authorization changes:
  // Old client (clientA) access -> DENIED (account not returned in their account list)
  const oldClientAccounts = await TradingAccountService.getUserAccounts(clientA.user.id);
  const oldClientHasAccount = oldClientAccounts.some((a) => a.id === assignedAccount.id);
  assert(!oldClientHasAccount, 'Old client account access = DENIED');

  // New client (clientB) access -> ALLOWED (account returned in their account list)
  const newClientAccounts = await TradingAccountService.getUserAccounts(clientB.user.id);
  const newClientHasAccount = newClientAccounts.some((a) => a.id === assignedAccount.id);
  assert(newClientHasAccount, 'New client account access = ALLOWED');

  // Verify audit log
  const assignAuditLog = assignResult.audit_trail.find((log) => log.action === 'TRADING_ACCOUNT_ASSIGNED');
  assert(assignAuditLog !== undefined, 'TRADING_ACCOUNT_ASSIGNED audit record logged');
  assert(assignAuditLog?.details.previous_user_id === clientA.user.id, 'Audit log preserves previous owner ID');
  assert(assignAuditLog?.details.new_user_id === clientB.user.id, 'Audit log preserves new owner ID');

  // ===========================================================================
  // 4. CLIENT TRADING PASSWORD RESET REQUEST WORKFLOW
  // ===========================================================================
  console.log('\n[4] Client Trading Password Reset Request Workflow Verification:');

  const clientResetUser = await AuthService.register({
    email: 'reset.client@test.com',
    password: 'Password123!@#',
    first_name: 'Reset',
    last_name: 'Requester',
    country: 'US',
    preferred_currency: 'USD',
  });
  const resetClientId = clientResetUser.user.id;

  const resetAccount = await TradingAccountService.registerAccount(resetClientId, {
    platform: 'MT5',
    currency: 'USD',
    leverage: '1:100',
    account_type: 'standard',
    is_demo: false,
  });

  // 4.1 IDOR Protection: client cannot request reset for an account owned by another user
  try {
    await TradingAccountService.requestPasswordReset(
      clientA.user.id, // clientA trying to request reset on resetAccount
      resetAccount.id,
      'Unauthorized request attempt'
    );
    assert(false, 'Should block IDOR password reset request');
  } catch (err: any) {
    assert(err.message.includes('Access forbidden') || err.message.includes('not found') || err.statusCode === 403, 'Blocked IDOR password reset request');
  }

  // 4.2 Client submits legitimate password reset request
  const resetRequest = await TradingAccountService.requestPasswordReset(
    resetClientId,
    resetAccount.id,
    'Lost mobile terminal credentials'
  );
  assert(resetRequest.id !== undefined, 'Reset request created with unique ID');
  assert(resetRequest.status === 'pending', 'Reset request is pending');
  assert(resetRequest.reason === 'Lost mobile terminal credentials', 'Reason preserved');

  // Prevent duplicate concurrent pending requests
  try {
    await TradingAccountService.requestPasswordReset(
      resetClientId,
      resetAccount.id,
      'Second request attempt'
    );
    assert(false, 'Should block duplicate pending request');
  } catch (err: any) {
    assert(err.message.includes('already pending'), 'Blocked duplicate pending reset request');
  }

  // 4.3 Admin lists requests
  const adminResets = await TradingAccountService.getAllPasswordResetsAdmin({ status: 'pending' });
  const foundInAdminList = adminResets.find((r) => r.id === resetRequest.id);
  assert(foundInAdminList !== undefined, 'Admin views pending reset request in queue');
  assert(foundInAdminList?.client_email === 'reset.client@test.com', 'Request enriched with client owner details');

  // 4.4 Admin approves request with desk notes & credential update
  const processResult = await TradingAccountService.processPasswordResetAdmin(
    adminId,
    resetRequest.id,
    'approve',
    {
      new_password: 'NewTempPassword2026!',
      admin_notes: 'Verified via security call and dispatched to client',
    }
  );
  assert(processResult.success === true, 'Admin successfully processed reset request');
  assert(processResult.data.status === 'approved', 'Request status updated to approved');

  // 4.5 Security check: Verify no plaintext passwords in audit logs
  const auditLogsForReset = inMemoryDb.auditLogs.filter(
    (log) => log.entity_id === resetAccount.id || log.details?.request_id === resetRequest.id
  );
  for (const log of auditLogsForReset) {
    const detailsStr = JSON.stringify(log.details);
    assert(!detailsStr.includes('NewTempPassword2026!'), 'Plaintext password strictly excluded from audit log');
  }

  // 4.6 Rejection flow test
  const demoResetAccount = await TradingAccountService.provisionDefaultDemoAccount(clientA.user.id);
  const rejectReq = await TradingAccountService.requestPasswordReset(
    clientA.user.id,
    demoResetAccount.id,
    'Reset for demo account'
  );
  const rejectResult = await TradingAccountService.processPasswordResetAdmin(
    adminId,
    rejectReq.id,
    'reject',
    {
      rejection_reason: 'Account credentials already active in WebTrader',
      admin_notes: 'Client informed via ticket',
    }
  );
  assert(rejectResult.data.status === 'rejected', 'Request rejection processed successfully');

  // Summary
  console.log('\n=============================================================================');
  console.log(`🎉 PROMPT 5003-B Verification Complete: ${passed} passed, ${failed} failed`);
  console.log('=============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPrompt5003bTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
