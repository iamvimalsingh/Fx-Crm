import 'dotenv/config';
import jwt from 'jsonwebtoken';
import {
  generateToken,
  generateTradingLaunchToken,
  generateTradingSsoToken,
  verifyToken,
  verifyTradingLaunchToken,
  getJwtSecret,
  getCrmLaunchSecret,
} from './netlify/functions/middleware/auth';
import { handler } from './netlify/functions/api';
import { inMemoryDb } from './netlify/functions/db/client';

process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runSsoIntegrationTests() {
  console.log('🧪 Starting CRM → Trading Engine Client SSO Integration Test Suite...\n');

  // Clear in-memory database and seed test accounts
  inMemoryDb.users.clear();
  inMemoryDb.tradingAccounts.clear();
  inMemoryDb.auditLogs = [];

  const userA = {
    id: 'user-client-1111-aaaa',
    email: 'trader1@broker.com',
    password_hash: 'hash_123',
    role: 'client' as const,
    status: 'active' as const,
    first_name: 'Alex',
    last_name: 'Trader',
    country: 'GB',
    preferred_currency: 'USD',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const userB = {
    id: 'user-client-2222-bbbb',
    email: 'trader2@broker.com',
    password_hash: 'hash_456',
    role: 'client' as const,
    status: 'active' as const,
    first_name: 'Bob',
    last_name: 'Investor',
    country: 'DE',
    preferred_currency: 'EUR',
    created_at: new Date(),
    updated_at: new Date(),
  };

  inMemoryDb.users.set(userA.id, userA);
  inMemoryDb.users.set(userB.id, userB);

  // Account 57775 owned by User A
  const account57775 = {
    id: 'acc-uuid-57775-live',
    account_number: '57775',
    user_id: userA.id,
    platform: 'MT5' as const,
    account_type: 'standard' as const,
    server_name: 'ForexCore-Live',
    currency: 'USD',
    leverage: '1:500',
    status: 'active' as const,
    balance: '25000.00',
    equity: '25450.20',
    is_demo: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  // Account 88888 owned by User B
  const account88888 = {
    id: 'acc-uuid-88888-raw',
    account_number: '88888',
    user_id: userB.id,
    platform: 'WebTrader' as const,
    account_type: 'raw_spread' as const,
    server_name: 'ForexCore-DMA',
    currency: 'EUR',
    leverage: '1:200',
    status: 'active' as const,
    balance: '5000.00',
    equity: '5000.00',
    is_demo: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  inMemoryDb.tradingAccounts.set(account57775.id, account57775);
  inMemoryDb.tradingAccounts.set(account88888.id, account88888);

  const tokenUserA = generateToken(userA);
  const tokenUserB = generateToken(userB);

  console.log('[1] Cryptographic Separation of JWT_SECRET and CRM_LAUNCH_SECRET:');
  const jwtSecret = getJwtSecret();
  const crmLaunchSecret = getCrmLaunchSecret();
  assert(typeof jwtSecret === 'string' && jwtSecret.length >= 32, 'JWT_SECRET is valid and has >= 32 chars');
  assert(typeof crmLaunchSecret === 'string' && crmLaunchSecret.length >= 32, 'CRM_LAUNCH_SECRET is valid and has >= 32 chars');
  assert(jwtSecret !== crmLaunchSecret, 'CRM_LAUNCH_SECRET is strictly distinct from JWT_SECRET');

  console.log('\n[2] Trading Launch Token Claims & Lifespan Contract:');
  const launchToken = generateTradingLaunchToken(userA, account57775, 'broker-tenant-1');
  const decodedLaunch: any = jwt.decode(launchToken);
  assert(!!decodedLaunch, 'Launch token decodes as valid JWT');
  assert(decodedLaunch.iss === 'crm-backend', 'Claim iss is crm-backend');
  assert(decodedLaunch.sub === userA.id, 'Claim sub matches authenticated user UUID');
  assert(decodedLaunch.aud === 'trading-terminal', 'Claim aud is trading-terminal');
  assert(decodedLaunch.accountId === account57775.id, 'Claim accountId matches CRM trading account UUID');
  assert(decodedLaunch.accountNumber === '57775', 'Claim accountNumber matches 57775');
  assert(decodedLaunch.clientId === userA.id, 'Claim clientId matches authenticated user UUID');
  assert(decodedLaunch.userId === userA.id, 'Claim userId matches authenticated user UUID');
  assert(decodedLaunch.tenantId === 'broker-tenant-1', 'Claim tenantId matches broker-tenant-1');
  assert(decodedLaunch.platform === 'MT5', 'Claim platform is MT5');
  assert(decodedLaunch.currency === 'USD', 'Claim currency is USD');
  assert(decodedLaunch.accountType === 'standard', 'Claim accountType is standard');
  assert(decodedLaunch.leverage === 500, 'Claim leverage is canonical numeric 500');
  assert(typeof decodedLaunch.balance === 'number' && decodedLaunch.balance === 25000, 'Claim balance is canonical numeric 25000');
  assert(typeof decodedLaunch.initialBalance === 'number' && decodedLaunch.initialBalance === 25000, 'Claim initialBalance is canonical numeric 25000');
  assert(decodedLaunch.type === 'trading_session', 'Claim type is trading_session');

  // Verify expiration is short-lived (~300s / 5m)
  const ttlSeconds = decodedLaunch.exp - decodedLaunch.iat;
  assert(ttlSeconds === 300, `Token lifetime is exactly 300 seconds (5 minutes) (actual: ${ttlSeconds}s)`);

  // Verify verification with CRM_LAUNCH_SECRET passes
  const verifiedLaunch = verifyTradingLaunchToken(launchToken);
  assert(verifiedLaunch !== null && verifiedLaunch.accountNumber === '57775', 'verifyTradingLaunchToken succeeds with CRM_LAUNCH_SECRET');

  // Verify verification with JWT_SECRET FAILS (Cryptographic Barrier)
  let jwtSecretVerifyFailed = false;
  try {
    jwt.verify(launchToken, jwtSecret);
  } catch {
    jwtSecretVerifyFailed = true;
  }
  assert(jwtSecretVerifyFailed, 'CRM JWT_SECRET cannot verify or decode launch token (barrier intact)');

  console.log('\n[3] API Endpoint: POST /api/trading-accounts/:id/sso-token Verification:');

  // Test 3.1: Authenticated User A requests SSO token for their own account 57775
  const resValid: any = await handler(
    {
      path: `/api/trading-accounts/${account57775.id}/sso-token`,
      httpMethod: 'POST',
      headers: {
        authorization: `Bearer ${tokenUserA}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    } as any,
    {} as any
  );

  assert(resValid?.statusCode === 200, 'Authenticated client receives HTTP 200 for own account 57775');
  const bodyValid = JSON.parse(resValid?.body || '{}');
  assert(bodyValid.status === 'success', 'Response status is success');
  assert(!!bodyValid.data?.token, 'Response contains signed launch token');
  assert(bodyValid.data?.account?.account_number === '57775', 'Response contains account 57775 metadata');
  assert(bodyValid.data?.account?.platform === 'MT5', 'Response contains MT5 platform');

  // Verify the token returned over HTTP is verifiable by Trading Engine launch secret
  const httpTokenVerified = verifyTradingLaunchToken(bodyValid.data.token);
  assert(httpTokenVerified !== null && httpTokenVerified.accountNumber === '57775', 'HTTP returned token is verified by CRM_LAUNCH_SECRET');

  // Test 3.2: Unauthenticated request is rejected (401)
  const resUnauth: any = await handler(
    {
      path: `/api/trading-accounts/${account57775.id}/sso-token`,
      httpMethod: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    } as any,
    {} as any
  );
  assert(resUnauth?.statusCode === 401, 'Unauthenticated request is rejected with HTTP 401');

  // Test 3.3: IDOR Attack: User A attempts to request SSO token for User B's account 88888
  const resIdor: any = await handler(
    {
      path: `/api/trading-accounts/${account88888.id}/sso-token`,
      httpMethod: 'POST',
      headers: {
        authorization: `Bearer ${tokenUserA}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    } as any,
    {} as any
  );
  assert(resIdor?.statusCode === 403, 'IDOR attack blocked: Client cannot generate launch token for unowned account 88888 (HTTP 403)');

  // Test 3.4: Non-existent account ID returns 404
  const resNotFound: any = await handler(
    {
      path: `/api/trading-accounts/non-existent-acc-id/sso-token`,
      httpMethod: 'POST',
      headers: {
        authorization: `Bearer ${tokenUserA}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    } as any,
    {} as any
  );
  assert(resNotFound?.statusCode === 404, 'Non-existent account ID returns HTTP 404');

  // Test 3.5: Generic POST /api/trading-accounts/sso-token with body account_id
  const resGenericWithId: any = await handler(
    {
      path: `/api/trading-accounts/sso-token`,
      httpMethod: 'POST',
      headers: {
        authorization: `Bearer ${tokenUserA}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ account_id: account57775.id }),
    } as any,
    {} as any
  );
  assert(resGenericWithId?.statusCode === 200, 'Generic SSO endpoint with account_id in body succeeds for owned account');
  const bodyGeneric = JSON.parse(resGenericWithId?.body || '{}');
  assert(bodyGeneric.data?.account?.account_number === '57775', 'Generic SSO endpoint correctly maps to account 57775');

  console.log('\n=============================================================================');
  console.log(`🎉 Client SSO Integration Suite Completed: ${passedTests} passed, ${failedTests} failed.`);
  console.log('=============================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSsoIntegrationTests().catch((err) => {
  console.error('Fatal error in SSO integration tests:', err);
  process.exit(1);
});
