process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';

/**
 * Trading Account Registry Module - Authorization, IDOR Protection & Workflows Test Suite
 */
import { handler } from './netlify/functions/api';
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

async function runTests() {
  console.log('🧪 Starting Trading Account Registry & IDOR Security Test Suite...\n');

  // Reset in-memory database to pristine baseline
  inMemoryDb.clear();

  // -------------------------------------------------------------------------
  // [1] Initial Bootstrap: Create Admin, Client A, and Client B
  // -------------------------------------------------------------------------
  console.log('[1] User Setup & Initial Bootstrap:');

  // Setup Admin
  const adminSetupRes = await callApi({
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
  assert(adminSetupRes.status === 201, 'Admin bootstrap succeeded');
  const adminToken = adminSetupRes.body.data.token;

  // Register Client A
  const clientARes = await callApi({
    path: '/api/auth/register',
    method: 'POST',
    body: {
      email: 'client_alice@example.com',
      password: 'AlicePassword@123',
      first_name: 'Alice',
      last_name: 'Trader',
      country: 'US',
      preferred_currency: 'USD',
    },
  });
  assert(clientARes.status === 201, 'Client Alice registered');
  const clientAToken = clientARes.body.data.token;
  const clientAId = clientARes.body.data.user.id;

  // Verify Alice has 1 auto-provisioned default demo account upon registration
  const aliceInitialAccRes = await callApi({
    path: '/api/trading-accounts',
    method: 'GET',
    token: clientAToken,
  });
  assert(aliceInitialAccRes.status === 200, 'Alice fetches accounts immediately after registration');
  assert(aliceInitialAccRes.body.data.length === 1, 'Alice has 1 default demo account auto-provisioned upon registration');
  const aliceDefaultDemo = aliceInitialAccRes.body.data[0];
  assert(aliceDefaultDemo.is_demo === true, 'Default account is marked is_demo=true');
  assert(aliceDefaultDemo.status === 'active', 'Default demo account is immediately active');
  assert(aliceDefaultDemo.balance === '10000.00', 'Default demo balance is 10000.00');
  assert(aliceDefaultDemo.currency === 'USD', 'Default demo currency matches preferred currency (USD)');
  assert(Boolean(aliceDefaultDemo.password), 'Default demo account has generated password');
  assert(aliceDefaultDemo.password.startsWith('Demo@'), 'Demo password uses generated Demo@ pattern');
  assert(Boolean(aliceDefaultDemo.account_number), 'Default demo account has generated account number');

  // Register Client B
  const clientBRes = await callApi({
    path: '/api/auth/register',
    method: 'POST',
    body: {
      email: 'client_bob@example.com',
      password: 'BobPassword@123',
      first_name: 'Bob',
      last_name: 'Investor',
      country: 'DE',
      preferred_currency: 'EUR',
    },
  });
  assert(clientBRes.status === 201, 'Client Bob registered');
  const clientBToken = clientBRes.body.data.token;
  const clientBId = clientBRes.body.data.user.id;

  // Verify Bob has 1 auto-provisioned default demo account in EUR
  const bobInitialAccRes = await callApi({
    path: '/api/trading-accounts',
    method: 'GET',
    token: clientBToken,
  });
  assert(bobInitialAccRes.status === 200, 'Bob fetches accounts immediately after registration');
  assert(bobInitialAccRes.body.data.length === 1, 'Bob has 1 default demo account auto-provisioned upon registration');
  const bobDefaultDemo = bobInitialAccRes.body.data[0];
  assert(bobDefaultDemo.is_demo === true, 'Bob default account is demo');
  assert(bobDefaultDemo.currency === 'EUR', 'Bob demo account uses preferred currency (EUR)');
  assert(bobDefaultDemo.password !== aliceDefaultDemo.password, 'Bob has distinct random password from Alice');

  // -------------------------------------------------------------------------
  // [2] Authorization & RBAC Route Protection
  // -------------------------------------------------------------------------
  console.log('\n[2] Authorization & RBAC Route Protection:');

  // Unauthenticated client route access
  const unauthClientRes = await callApi({
    path: '/api/trading-accounts',
    method: 'GET',
    token: null,
  });
  assert(unauthClientRes.status === 401, 'Unauthenticated access to /api/trading-accounts returns 401');

  // Unauthenticated admin route access
  const unauthAdminRes = await callApi({
    path: '/api/admin/trading-accounts',
    method: 'GET',
    token: null,
  });
  assert(unauthAdminRes.status === 401, 'Unauthenticated access to /api/admin/trading-accounts returns 401');

  // Client Bob attempting to access admin trading accounts route
  const clientAsAdminRes = await callApi({
    path: '/api/admin/trading-accounts',
    method: 'GET',
    token: clientBToken,
  });
  assert(clientAsAdminRes.status === 403, 'Regular client access to /api/admin/trading-accounts returns 403 Forbidden');

  // Client Bob attempting admin approval action
  const clientApproveRes = await callApi({
    path: '/api/admin/trading-accounts/fake-id/approve',
    method: 'POST',
    token: clientBToken,
    body: {},
  });
  assert(clientApproveRes.status === 403, 'Regular client cannot execute admin approval endpoint (403)');

  // -------------------------------------------------------------------------
  // [3] Client A Trading Account Registration
  // -------------------------------------------------------------------------
  console.log('\n[3] Trading Account Registration Workflow:');

  // Client A registers a Live MT5 account
  const regLiveRes = await callApi({
    path: '/api/trading-accounts/register',
    method: 'POST',
    token: clientAToken,
    body: {
      platform: 'MT5',
      account_type: 'raw_spread',
      currency: 'USD',
      leverage: '1:200',
      nickname: "Alice's Primary Scalper",
      is_demo: false,
    },
  });
  assert(regLiveRes.status === 201, 'Client A registers Live MT5 account (201 Created)');
  const aliceLiveAccount = regLiveRes.body.data;
  assert(aliceLiveAccount.platform === 'MT5', 'Platform is MT5');
  assert(aliceLiveAccount.account_type === 'raw_spread', 'Account type is raw_spread');
  assert(aliceLiveAccount.leverage === '1:200', 'Leverage is 1:200');
  assert(aliceLiveAccount.status === 'pending_approval', 'Live account has status "pending_approval"');
  assert(Boolean(aliceLiveAccount.account_number), `Generated account login number: ${aliceLiveAccount.account_number}`);
  assert(aliceLiveAccount.user_id === clientAId, 'Account is owned by Client A');

  // Client A registers a Demo MT4 account
  const regDemoRes = await callApi({
    path: '/api/trading-accounts/register',
    method: 'POST',
    token: clientAToken,
    body: {
      platform: 'MT4',
      account_type: 'standard',
      currency: 'USD',
      leverage: '1:100',
      nickname: 'Test Bot Account',
      is_demo: true,
    },
  });
  assert(regDemoRes.status === 201, 'Client A registers Demo MT4 account');
  const aliceDemoAccount = regDemoRes.body.data;
  assert(aliceDemoAccount.is_demo === true, 'Account is flagged as demo');
  assert(aliceDemoAccount.status === 'active', 'Demo account is instantly active');

  // Client A lists their trading accounts
  const listAliceRes = await callApi({
    path: '/api/trading-accounts',
    method: 'GET',
    token: clientAToken,
  });
  assert(listAliceRes.status === 200, 'Client A fetches their own account list');
  assert(listAliceRes.body.data.length === 3, 'Client A has 3 trading accounts (1 default demo + 1 live + 1 custom demo)');

  // -------------------------------------------------------------------------
  // [4] IDOR (Insecure Direct Object Reference) Protection Tests
  // -------------------------------------------------------------------------
  console.log('\n[4] IDOR Protection Tests:');

  // Test 1: Client A can view their own account detail
  const aliceViewOwnRes = await callApi({
    path: `/api/trading-accounts/${aliceLiveAccount.id}`,
    method: 'GET',
    token: clientAToken,
  });
  assert(aliceViewOwnRes.status === 200, 'Owner (Alice) can view her trading account');
  assert(aliceViewOwnRes.body.data.id === aliceLiveAccount.id, 'Returns correct account record');

  // Test 2: Client B (attacker) attempts to view Client A's trading account by ID
  const bobViewAliceRes = await callApi({
    path: `/api/trading-accounts/${aliceLiveAccount.id}`,
    method: 'GET',
    token: clientBToken, // Bob's token
  });
  assert(
    bobViewAliceRes.status === 403,
    `IDOR Blocked: Other user (Bob) cannot view Alice's account (got HTTP ${bobViewAliceRes.status})`
  );
  assert(
    bobViewAliceRes.body.message.includes('forbidden') || bobViewAliceRes.body.message.includes('permission'),
    'Returns forbidden security message'
  );

  // Test 3: Client B attempts to update Client A's account nickname
  const bobUpdateAliceNickRes = await callApi({
    path: `/api/trading-accounts/${aliceLiveAccount.id}/nickname`,
    method: 'PATCH',
    token: clientBToken,
    body: { nickname: 'Hacked by Bob' },
  });
  assert(
    bobUpdateAliceNickRes.status === 403,
    `IDOR Blocked: Other user cannot modify Alice's nickname (got HTTP ${bobUpdateAliceNickRes.status})`
  );

  // Verify Alice's nickname is unchanged
  const aliceCheckNick = await callApi({
    path: `/api/trading-accounts/${aliceLiveAccount.id}`,
    method: 'GET',
    token: clientAToken,
  });
  assert(
    aliceCheckNick.body.data.nickname === "Alice's Primary Scalper",
    "Alice's nickname remained intact"
  );

  // Test 4: Client A updates her own nickname
  const aliceUpdateNickRes = await callApi({
    path: `/api/trading-accounts/${aliceLiveAccount.id}/nickname`,
    method: 'PATCH',
    token: clientAToken,
    body: { nickname: 'Alice Main EA Strategy' },
  });
  assert(aliceUpdateNickRes.status === 200, 'Owner can update her own account nickname');
  assert(aliceUpdateNickRes.body.data.nickname === 'Alice Main EA Strategy', 'Nickname updated successfully');

  // Test 5: Client B attempts to request leverage change on Alice's account
  const bobReqLevAlice = await callApi({
    path: `/api/trading-accounts/${aliceLiveAccount.id}/request-leverage`,
    method: 'POST',
    token: clientBToken,
    body: { requested_leverage: '1:500', reason: 'Malicious leverage request' },
  });
  assert(
    bobReqLevAlice.status === 403,
    `IDOR Blocked: Other user cannot request leverage change on Alice's account (got HTTP ${bobReqLevAlice.status})`
  );

  // Test 6: Alice requests leverage change on her own account
  const aliceReqLev = await callApi({
    path: `/api/trading-accounts/${aliceLiveAccount.id}/request-leverage`,
    method: 'POST',
    token: clientAToken,
    body: { requested_leverage: '1:400', reason: 'Increasing lot size on EURUSD' },
  });
  assert(aliceReqLev.status === 200, 'Owner can request leverage adjustment on own account');

  // -------------------------------------------------------------------------
  // [5] Account Linking Workflow & Duplicate Prevention
  // -------------------------------------------------------------------------
  console.log('\n[5] Account Linking Workflow & Duplicate Prevention:');

  const linkRes = await callApi({
    path: '/api/trading-accounts/link',
    method: 'POST',
    token: clientAToken,
    body: {
      account_number: '778899',
      platform: 'cTrader',
      server_name: 'Broker-cTrader-Live',
      account_type: 'pro',
      currency: 'USD',
      leverage: '1:100',
      nickname: 'Linked cTrader Account',
      investor_notes: 'External existing account opened in London',
    },
  });
  assert(linkRes.status === 201, 'Client A links external cTrader account');
  const linkedAccount = linkRes.body.data;
  assert(linkedAccount.account_number === '778899', 'Account number matches');
  assert(linkedAccount.status === 'pending_approval', 'Linked account requires administrative review');

  // Duplicate linking attempt by Bob for same account number and platform
  const duplicateLinkRes = await callApi({
    path: '/api/trading-accounts/link',
    method: 'POST',
    token: clientBToken,
    body: {
      account_number: '778899',
      platform: 'cTrader',
      server_name: 'Broker-cTrader-Live',
      currency: 'USD',
    },
  });
  assert(
    duplicateLinkRes.status === 400,
    'Duplicate account linking blocked with error (already in CRM)'
  );

  // -------------------------------------------------------------------------
  // [6] Admin Review & Management Workflows
  // -------------------------------------------------------------------------
  console.log('\n[6] Admin Review & Operations Workflows:');

  // Admin lists all accounts
  const adminListRes = await callApi({
    path: '/api/admin/trading-accounts',
    method: 'GET',
    token: adminToken,
  });
  assert(adminListRes.status === 200, 'Admin fetches all trading accounts across users');
  assert(adminListRes.body.data.length === 5, 'Admin sees all 5 trading accounts (Alice 4 + Bob 1)');

  // Admin inspects Bob's demo account and updates demo credentials
  const bobDemoFromAdmin = adminListRes.body.data.find((a: any) => a.user_id === clientBId && a.is_demo);
  assert(Boolean(bobDemoFromAdmin), 'Admin finds Bob demo account');

  const updateDemoRes = await callApi({
    path: `/api/admin/trading-accounts/${bobDemoFromAdmin.id}/metadata`,
    method: 'PATCH',
    token: adminToken,
    body: {
      password: 'DemoUpdated#999',
      balance: '25000.00',
      server_name: 'Broker-MT5-Demo-VIP',
      terminal_url: 'https://trade.mql5.com/trade?server=Broker-MT5-Demo-VIP',
      admin_notes: 'Updated Bob demo balance and credentials for competition',
    },
  });
  assert(updateDemoRes.status === 200, 'Admin successfully updates demo account credentials and balance');
  assert(updateDemoRes.body.data.password === 'DemoUpdated#999', 'Demo password updated in record');
  assert(updateDemoRes.body.data.balance === '25000.00', 'Demo balance updated to 25000.00');
  assert(updateDemoRes.body.data.server_name === 'Broker-MT5-Demo-VIP', 'Demo server name updated');

  // Bob verifies the updated demo balance and credentials
  const bobCheckRes = await callApi({
    path: '/api/trading-accounts',
    method: 'GET',
    token: clientBToken,
  });
  const bobUpdatedDemo = bobCheckRes.body.data.find((a: any) => a.id === bobDemoFromAdmin.id);
  assert(bobUpdatedDemo.balance === '25000.00', 'Bob sees updated demo balance (25000.00)');
  assert(bobUpdatedDemo.password === 'DemoUpdated#999', 'Bob sees updated demo password');

  // Verify Audit Log does NOT contain plaintext password
  const bobAuditRes = await callApi({
    path: `/api/admin/trading-accounts/${bobDemoFromAdmin.id}`,
    method: 'GET',
    token: adminToken,
  });
  assert(bobAuditRes.status === 200, 'Admin fetches Bob demo detail with audit trail');
  const auditLogs = bobAuditRes.body.data.audit_trail;
  assert(auditLogs.length > 0, 'Audit trail exists for demo account');
  const leakedPassword = auditLogs.some((log: any) => 
    JSON.stringify(log.details || {}).includes('DemoUpdated#999') ||
    (log.action || '').includes('DemoUpdated#999')
  );
  assert(!leakedPassword, 'Audit logs NEVER store or leak plaintext demo passwords');

  // Admin inspects account detail with owner and audit trail
  const adminDetailRes = await callApi({
    path: `/api/admin/trading-accounts/${aliceLiveAccount.id}`,
    method: 'GET',
    token: adminToken,
  });
  assert(adminDetailRes.status === 200, 'Admin fetches account detail with audit trail');
  assert(adminDetailRes.body.data.account.owner.email === 'client_alice@example.com', 'Includes owner profile');
  assert(adminDetailRes.body.data.audit_trail.length > 0, 'Includes audit trail logs');

  // Admin approves Alice's live account
  const approveRes = await callApi({
    path: `/api/admin/trading-accounts/${aliceLiveAccount.id}/approve`,
    method: 'POST',
    token: adminToken,
    body: {
      server_name: 'Broker-MT5-Live-Alpha',
      group_tier: 'raw_vip_usd',
      admin_notes: 'Verified KYC tier 1 and assigned Alpha server',
    },
  });
  assert(approveRes.status === 200, 'Admin approves pending account');
  assert(approveRes.body.data.status === 'active', 'Account status transitioned to "active"');
  assert(approveRes.body.data.server_name === 'Broker-MT5-Live-Alpha', 'Server name updated by admin');
  assert(Boolean(approveRes.body.data.approved_at), 'approved_at timestamp recorded');

  // Admin rejects the linked account
  const rejectRes = await callApi({
    path: `/api/admin/trading-accounts/${linkedAccount.id}/reject`,
    method: 'POST',
    token: adminToken,
    body: {
      rejection_reason: 'Account number could not be verified on external cTrader broker database',
      admin_notes: 'Client contacted via support ticket',
    },
  });
  assert(rejectRes.status === 200, 'Admin rejects unverified account link');
  assert(rejectRes.body.data.status === 'disabled', 'Status changed to disabled');
  assert(
    rejectRes.body.data.rejection_reason === 'Account number could not be verified on external cTrader broker database',
    'Rejection reason recorded'
  );

  // Admin updates account status to read_only (e.g. risk management suspension)
  const statusRes = await callApi({
    path: `/api/admin/trading-accounts/${aliceLiveAccount.id}/status`,
    method: 'PATCH',
    token: adminToken,
    body: {
      status: 'read_only',
      admin_notes: 'Placed in read-only mode pending weekend margin compliance review',
    },
  });
  assert(statusRes.status === 200, 'Admin updates status to "read_only"');
  assert(statusRes.body.data.status === 'read_only', 'Status is read_only');

  // Admin updates metadata (leverage change)
  const metaRes = await callApi({
    path: `/api/admin/trading-accounts/${aliceLiveAccount.id}/metadata`,
    method: 'PATCH',
    token: adminToken,
    body: {
      leverage: '1:400',
      admin_notes: 'Approved leverage increase request to 1:400',
    },
  });
  assert(metaRes.status === 200, 'Admin updates metadata (leverage)');
  assert(metaRes.body.data.leverage === '1:400', 'Leverage updated to 1:400');

  // Admin restores status back to active
  const restoreRes = await callApi({
    path: `/api/admin/trading-accounts/${aliceLiveAccount.id}/status`,
    method: 'PATCH',
    token: adminToken,
    body: {
      status: 'active',
      admin_notes: 'Review complete; account restored to active',
    },
  });
  assert(restoreRes.status === 200, 'Admin restored status to active');
  assert(restoreRes.body.data.status === 'active', 'Status is active');

  // -------------------------------------------------------------------------
  // [7] Isolation from Financial Ledger
  // -------------------------------------------------------------------------
  console.log('\n[7] Financial Ledger Isolation Verification:');

  // Verify Alice's wallet balance
  const aliceWalletRes = await callApi({
    path: '/api/financial/wallet',
    method: 'GET',
    token: clientAToken,
  });
  assert(aliceWalletRes.status === 200, 'Alice wallet fetched');
  assert(aliceWalletRes.body.data.balance === '0.00', 'Wallet balance is exactly 0.00 (untouched)');
  assert(aliceWalletRes.body.data.reserved_balance === '0.00', 'Reserved balance is 0.00 (untouched)');

  // Verify financial transactions ledger has 0 records
  assert(
    inMemoryDb.transactions.length === 0,
    'Financial transactions ledger is completely empty (no trading records in ledger)'
  );
  assert(
    inMemoryDb.deposits.size === 0,
    'Deposits store is completely empty'
  );
  assert(
    inMemoryDb.withdrawals.size === 0,
    'Withdrawals store is completely empty'
  );

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n========================================');
  console.log(`🎉 Trading Account Test Suite: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
