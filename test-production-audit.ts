process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';

/**
 * Production Audit Test Runner
 * Validates Security, Hardening, Rate Limiting, Path Traversal, and Ledger Isolation
 */
import { handler } from './netlify/functions/api';
import { rateLimiter } from './netlify/functions/middleware/rate-limiter';
import { inMemoryDb } from './netlify/functions/db/client';

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

async function callEndpoint(event: any): Promise<{ statusCode: number; headers: Record<string, string>; data: any }> {
  const res: any = await handler(event, {} as any);
  let parsed: any = null;
  try {
    parsed = res?.body ? JSON.parse(res.body) : null;
  } catch {
    parsed = res?.body;
  }
  return {
    statusCode: res?.statusCode || 500,
    headers: res?.headers || {},
    data: parsed,
  };
}

async function runAuditTests() {
  console.log('🧪 Starting Netlify-Native CRM Production Audit Test Suite...\n');

  // Reset in-memory state
  inMemoryDb.clear();
  rateLimiter.reset();

  // 1. Initial Admin Setup
  console.log('[1] Authentication Security & Setup:');
  const setupRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/auth/setup-admin',
    headers: { 'client-ip': '10.0.0.1', 'user-agent': 'AuditBot/1.0' },
    body: JSON.stringify({
      email: 'security-admin@broker.com',
      password: 'AdminSuperPassword123!',
      first_name: 'Lead',
      last_name: 'Auditor',
      country: 'GB',
      preferred_currency: 'USD',
      setup_secret: process.env.ADMIN_SETUP_SECRET || 'forex-crm-secure-admin-setup-secret-2026',
    }),
  });
  assert(setupRes.statusCode === 201, 'Admin setup returns 201 Created');
  const adminToken = setupRes.data.data.token;
  assert(!!adminToken, 'Admin token generated on setup');

  // 2. Rate Limiting Protection
  console.log('\n[2] Rate Limiting & Brute-Force Defense:');
  // Attempt 6 rapid setup-admin calls from the same IP (limit is 5/min)
  let hitRateLimit = false;
  let retryAfterHeader: string | undefined;
  for (let i = 0; i < 6; i++) {
    const res = await callEndpoint({
      httpMethod: 'POST',
      path: '/api/auth/setup-admin',
      headers: { 'client-ip': '192.168.1.50' },
      body: JSON.stringify({
        email: 'attacker@evil.com',
        password: 'Password123!',
      }),
    });
    if (res.statusCode === 429) {
      hitRateLimit = true;
      retryAfterHeader = res.headers['Retry-After'];
      break;
    }
  }
  assert(hitRateLimit, 'Rate limiter triggered HTTP 429 on excessive requests');
  assert(!!retryAfterHeader && Number(retryAfterHeader) > 0, `Retry-After header returned (${retryAfterHeader}s)`);

  // 3. Invalid JSON Payload Safety
  console.log('\n[3] Input Validation & Malformed Payload Handling:');
  const badJsonRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/auth/login',
    headers: { 'client-ip': '10.0.0.2' },
    body: '{"email": "broken-json, missing brackets',
  });
  assert(badJsonRes.statusCode === 400, 'Malformed JSON returns clean HTTP 400 Bad Request');
  assert(badJsonRes.data.message.includes('JSON'), 'Error message clarifies invalid JSON payload');

  // 4. File Upload & Path Traversal Security:
  console.log('\n[4] File Upload & Path Traversal Security:');
  // Register client Alice
  const aliceRegRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/auth/register',
    headers: { 'client-ip': '10.0.0.3' },
    body: JSON.stringify({
      email: 'alice@trader.com',
      password: 'Password123!',
      first_name: 'Alice',
      last_name: 'Trader',
      country: 'US',
      preferred_currency: 'USD',
    }),
  });
  assert(aliceRegRes.statusCode === 201, 'Client Alice registered');
  const aliceToken = aliceRegRes.data.data.token;

  // Alice attempts path traversal in proof_file_path
  const traversalRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/financial/deposits',
    headers: {
      Authorization: `Bearer ${aliceToken}`,
      'client-ip': '10.0.0.3',
    },
    body: JSON.stringify({
      amount: '100.00',
      payment_method_id: 'pm-crypto-usdt',
      currency: 'USD',
      proof_file_path: '../../../../etc/passwd',
    }),
  });
  assert(traversalRes.statusCode === 422, 'Path traversal in proof_file_path blocked with HTTP 422 Unprocessable Entity');
  assert(
    traversalRes.data.errors.some((e: any) => e.message.includes('traversal')),
    'Validation error explicitly flags path traversal attempt'
  );

  // Valid file path accepted
  const validDepositRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/financial/deposits',
    headers: {
      Authorization: `Bearer ${aliceToken}`,
      'client-ip': '10.0.0.3',
    },
    body: JSON.stringify({
      amount: '100.00',
      payment_method_id: 'pm-crypto-usdt',
      currency: 'USD',
      proof_file_path: 'uploads/2026/09/receipt-alice-01.png',
    }),
  });
  assert(validDepositRes.statusCode === 201, 'Safe sanitized relative file path accepted');

  // 5. Audit Logging Verification
  console.log('\n[5] Comprehensive Audit Logging:');
  assert(inMemoryDb.auditLogs.length > 0, `Audit logs present (count: ${inMemoryDb.auditLogs.length})`);
  const actions = inMemoryDb.auditLogs.map((l) => l.action);
  assert(actions.includes('ADMIN_INITIALIZED'), 'Audit log records ADMIN_INITIALIZED');
  assert(actions.includes('USER_REGISTERED'), 'Audit log records USER_REGISTERED');
  assert(actions.includes('DEPOSIT_SUBMITTED'), 'Audit log records DEPOSIT_SUBMITTED');

  // 6. Role-Based Access Control Boundaries
  console.log('\n[6] Authorization & Privilege Separation:');
  const forbiddenAdminRes = await callEndpoint({
    httpMethod: 'GET',
    path: '/api/financial/admin/audit-logs',
    headers: { Authorization: `Bearer ${aliceToken}` },
  });
  assert(forbiddenAdminRes.statusCode === 403, 'Regular client forbidden from admin audit logs (403)');

  const allowedAdminRes = await callEndpoint({
    httpMethod: 'GET',
    path: '/api/financial/admin/audit-logs',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(allowedAdminRes.statusCode === 200, 'Admin authorized to retrieve system audit logs (200)');

  // 7. Trading Account Registry Ledger Isolation
  console.log('\n[7] Trading Account Registry Ledger Isolation:');
  // Register trading account for Alice
  const regAccRes = await callEndpoint({
    httpMethod: 'POST',
    path: '/api/trading-accounts/register',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({
      platform: 'MT5',
      account_type: 'raw_spread',
      currency: 'USD',
      leverage: '1:100',
      is_demo: false,
    }),
  });
  assert(regAccRes.statusCode === 201, 'Trading account registered');

  // Verify wallet balance remained untouched
  const walletRes = await callEndpoint({
    httpMethod: 'GET',
    path: '/api/financial/wallet',
    headers: { Authorization: `Bearer ${aliceToken}` },
  });
  assert(walletRes.data.data.balance === '0.00', 'Wallet balance untouched by trading account registry (0.00)');
  assert(walletRes.data.data.reserved_balance === '0.00', 'Wallet reserved balance untouched (0.00)');
  assert(inMemoryDb.transactions.length === 0, 'Ledger transactions table untouched by trading account operations');

  console.log('\n========================================');
  console.log(`🎉 Audit Test Suite Complete: ${passCount} passed, ${failCount} failed`);
  console.log('========================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAuditTests().catch((err) => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
