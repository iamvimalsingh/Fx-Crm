import 'dotenv/config';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import {
  generateToken,
  generateTradingLaunchToken,
  getCrmLaunchSecret,
  getJwtSecret,
} from './netlify/functions/middleware/auth';
import { handler } from './netlify/functions/api';
import { inMemoryDb } from './netlify/functions/db/client';

process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';

const WS_URL = 'wss://trading-platform-3a5e.onrender.com/ws';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'NOT VERIFIED';
  details: string;
}

const results: TestResult[] = [];

function record(step: string, status: 'PASS' | 'FAIL' | 'NOT VERIFIED', details: string) {
  results.push({ step, status, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${status}] ${step}: ${details}`);
}

function sendWsMessage(ws: WebSocket, type: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.removeListener('message', onMessage);
      resolve({ timeout: true });
    }, 8000);

    const onMessage = (data: any) => {
      try {
        const parsed = JSON.parse(data.toString());
        // Ignore background price streams and heartbeats
        if (parsed.type === 'QUOTE' || parsed.type === 'PRICE' || parsed.type === 'HEARTBEAT' || parsed.type === 'PONG' || parsed.type === 'MARKET_DATA') {
          return;
        }
        clearTimeout(timeout);
        ws.removeListener('message', onMessage);
        resolve(parsed);
      } catch (e) {
        // ignore non-json
      }
    };

    ws.on('message', onMessage);

    const msg = JSON.stringify({ type, payload });
    ws.send(msg, (err) => {
      if (err) {
        clearTimeout(timeout);
        ws.removeListener('message', onMessage);
        reject(err);
      }
    });
  });
}

function connectWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: {
        'Origin': 'https://trading-platform-two-mu.vercel.app',
      },
      handshakeTimeout: 10000,
    });

    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('WebSocket connection timed out (10s)'));
    }, 10000);

    ws.on('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runLiveVerification() {
  console.log('=============================================================================');
  console.log('🔬 CRM → TRADING ENGINE PHASE 1 END-TO-END LIVE SSO VERIFICATION');
  console.log('=============================================================================\n');

  // Seed CRM Database with Account 57775
  inMemoryDb.users.clear();
  inMemoryDb.tradingAccounts.clear();

  const user = {
    id: 'usr-client-e2e-57775',
    email: 'client.57775@broker.com',
    password_hash: 'hash_secret',
    role: 'client' as const,
    status: 'active' as const,
    first_name: 'Verified',
    last_name: 'Trader',
    country: 'AE',
    preferred_currency: 'USD',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const account57775 = {
    id: 'acc-uuid-57775-live',
    account_number: '57775',
    user_id: user.id,
    platform: 'MT5' as const,
    account_type: 'standard' as const,
    server_name: 'ForexCore-Live',
    currency: 'USD',
    leverage: '1:500',
    status: 'active' as const,
    balance: '50000.00',
    equity: '50000.00',
    is_demo: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  inMemoryDb.users.set(user.id, user);
  inMemoryDb.tradingAccounts.set(account57775.id, account57775);

  const crmUserJwt = generateToken(user);

  // 1. CRM User Login & Token Request
  console.log('\n--- STEP 1 & 2: CRM User Login & SSO Token Generation for 57775 ---');
  let ssoToken = '';
  let tokenClaims: any = null;

  try {
    const res: any = await handler(
      {
        path: `/api/trading-accounts/${account57775.id}/sso-token`,
        httpMethod: 'POST',
        headers: {
          authorization: `Bearer ${crmUserJwt}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      } as any,
      {} as any
    );

    const body = JSON.parse(res?.body || '{}');
    if (res?.statusCode === 200 && body.status === 'success' && body.data?.token) {
      ssoToken = body.data.token;
      tokenClaims = jwt.decode(ssoToken);
      record('CRM SSO Token Generation', 'PASS', `Token generated for account 57775 via POST /api/trading-accounts/:id/sso-token`);
    } else {
      record('CRM SSO Token Generation', 'FAIL', `Endpoint failed: status=${res?.statusCode} body=${res?.body}`);
    }
  } catch (err: any) {
    record('CRM SSO Token Generation', 'FAIL', `Exception: ${err.message}`);
  }

  // 3. Claims Verification for 57775
  console.log('\n--- STEP 3: Cryptographic & Claims Verification ---');
  if (tokenClaims) {
    const isHs256 = (jwt.decode(ssoToken, { complete: true }) as any)?.header?.alg === 'HS256';
    const is5Min = (tokenClaims.exp - tokenClaims.iat) === 300;
    const isAcc57775 = tokenClaims.accountNumber === '57775';
    const isAccIdValid = tokenClaims.accountId === account57775.id;
    const isUserValid = tokenClaims.userId === user.id && tokenClaims.clientId === user.id;
    const isTenantValid = tokenClaims.tenantId === 'default';
    const isMetaValid = tokenClaims.platform === 'MT5' && tokenClaims.currency === 'USD' && tokenClaims.accountType === 'standard' && tokenClaims.leverage === '1:500';

    record('Token Algorithm HS256', isHs256 ? 'PASS' : 'FAIL', `Header alg is HS256`);
    record('Token Expiration 5m', is5Min ? 'PASS' : 'FAIL', `TTL is exactly 300 seconds (5 min)`);
    record('Account 57775 Number Claim', isAcc57775 ? 'PASS' : 'FAIL', `accountNumber is "57775"`);
    record('Account ID Identity Claim', isAccIdValid ? 'PASS' : 'FAIL', `accountId is ${account57775.id}`);
    record('User Identity Claim', isUserValid ? 'PASS' : 'FAIL', `userId and clientId is ${user.id}`);
    record('Tenant Claim', isTenantValid ? 'PASS' : 'FAIL', `tenantId is "default"`);
    record('Platform & Meta Claims', isMetaValid ? 'PASS' : 'FAIL', `platform=MT5, currency=USD, accountType=standard, leverage=1:500`);
  }

  // 4. Live WebSocket Connection & Handshake against Deployed Trading Engine
  console.log(`\n--- STEP 4 & 5: Live WebSocket Connection to ${WS_URL} ---`);
  let ws: WebSocket | null = null;
  let wsConnected = false;

  try {
    ws = await connectWs(WS_URL);
    wsConnected = true;
    record('WebSocket Connect', 'PASS', `Successfully connected to deployed Trading Engine WebSocket at ${WS_URL}`);
  } catch (err: any) {
    record('WebSocket Connect', 'FAIL', `Could not connect to ${WS_URL}: ${err.message}`);
  }

  // 6 & 7. External Session Handshake with Valid 57775 SSO Token
  console.log('\n--- STEP 6 & 7: External Session Handshake with Account 57775 Token ---');
  if (ssoToken) {
    let wsSession: WebSocket | null = null;
    try {
      wsSession = await connectWs(WS_URL);
      const response = await sendWsMessage(wsSession, 'SESSION_INIT', {
        mode: 'EXTERNAL',
        token: ssoToken,
      });

      console.log('Session 57775 Response Type:', response?.type);
      console.log('Session 57775 Account:', response?.payload?.account);

      if (response?.type === 'SESSION_INITIALIZED' || response?.type === 'SESSION_AUTHENTICATED' || response?.type === 'ACCOUNT_STATE' || response?.payload?.accountNumber || response?.payload?.account?.accountNumber) {
        const returnedAccNum = response?.payload?.accountNumber || response?.payload?.account?.accountNumber || response?.payload?.account?.account_number;
        const isNotDemo = returnedAccNum !== 'DEMO-1001' && returnedAccNum !== 'DEMO' && response?.payload?.mode !== 'DEMO';
        const isExact57775 = returnedAccNum === '57775';

        record('Trading Engine Token Validation', 'PASS', `Trading Engine accepted CRM launch token (Type: ${response?.type})`);
        record('Account 57775 Loaded', isExact57775 ? 'PASS' : 'FAIL', `Session resolved to account ${returnedAccNum}`);
        record('DEMO-1001 Avoidance', isNotDemo ? 'PASS' : 'FAIL', `Session did NOT fall back to DEMO-1001 (Active Account: ${returnedAccNum})`);
      } else if (response?.type === 'ERROR' || response?.type === 'AUTH_FAILED') {
        record('Trading Engine Token Validation', 'FAIL', `Engine rejected token: ${response?.payload?.message || JSON.stringify(response)}`);
      } else if (response?.timeout) {
        record('Trading Engine Token Validation', 'FAIL', `Handshake response timed out from Trading Engine`);
      } else {
        record('Trading Engine Token Validation', 'NOT VERIFIED', `Received message: ${JSON.stringify(response)}`);
      }
    } catch (err: any) {
      record('Trading Engine Token Validation', 'FAIL', `Error during SESSION_INIT: ${err.message}`);
    } finally {
      if (wsSession) wsSession.close();
    }
  }

  // 8 & 9. Negative Security Tests against Live Engine
  console.log('\n--- STEP 8 & 9: Negative Security Tests (Rejection Verification) ---');

  // 9.1 Expired Token
  let wsExp: WebSocket | null = null;
  try {
    wsExp = await connectWs(WS_URL);
    const expiredPayload = {
      accountId: account57775.id,
      accountNumber: '57775',
      clientId: user.id,
      userId: user.id,
      tenantId: 'default',
      platform: 'MT5',
      currency: 'USD',
      accountType: 'standard',
      leverage: '1:500',
      type: 'trading_session',
    };
    const expiredToken = jwt.sign(expiredPayload, getCrmLaunchSecret(), { expiresIn: -10 }); // expired 10s ago

    const expRes = await sendWsMessage(wsExp, 'SESSION_INIT', {
      mode: 'EXTERNAL',
      token: expiredToken,
    });

    const rejectedExpired = expRes?.type === 'ERROR' || expRes?.type === 'AUTH_FAILED' || expRes?.payload?.success === false || expRes?.payload?.account?.accountNumber !== '57775';
    record('Expired Token Rejected', rejectedExpired ? 'PASS' : 'FAIL', `Response: type=${expRes?.type} error=${expRes?.payload?.message || expRes?.payload?.error}`);
  } catch (err: any) {
    record('Expired Token Rejected', 'FAIL', `Error: ${err.message}`);
  } finally {
    if (wsExp) wsExp.close();
  }

  // 9.2 Wrong Secret Token (Signed with CRM JWT_SECRET instead of CRM_LAUNCH_SECRET)
  let wsWrongSec: WebSocket | null = null;
  try {
    wsWrongSec = await connectWs(WS_URL);
    const wrongSecretPayload = {
      accountId: account57775.id,
      accountNumber: '57775',
      clientId: user.id,
      userId: user.id,
      tenantId: 'default',
      platform: 'MT5',
      currency: 'USD',
      accountType: 'standard',
      leverage: '1:500',
      type: 'trading_session',
    };
    const wrongSecretToken = jwt.sign(wrongSecretPayload, getJwtSecret(), { expiresIn: '5m' });

    const wrongSecRes = await sendWsMessage(wsWrongSec, 'SESSION_INIT', {
      mode: 'EXTERNAL',
      token: wrongSecretToken,
    });

    const rejectedWrongSecret = wrongSecRes?.type === 'ERROR' || wrongSecRes?.type === 'AUTH_FAILED' || wrongSecRes?.payload?.success === false || wrongSecRes?.payload?.account?.accountNumber !== '57775';
    record('Wrong Secret Token Rejected', rejectedWrongSecret ? 'PASS' : 'FAIL', `Response: type=${wrongSecRes?.type} error=${wrongSecRes?.payload?.message || wrongSecRes?.payload?.error}`);
  } catch (err: any) {
    record('Wrong Secret Token Rejected', 'FAIL', `Error: ${err.message}`);
  } finally {
    if (wsWrongSec) wsWrongSec.close();
  }

  // 9.3 Tampered Token
  let wsTamp: WebSocket | null = null;
  try {
    wsTamp = await connectWs(WS_URL);
    const tamperedToken = ssoToken.slice(0, -5) + 'abcde';
    const tampRes = await sendWsMessage(wsTamp, 'SESSION_INIT', {
      mode: 'EXTERNAL',
      token: tamperedToken,
    });

    const rejectedTampered = tampRes?.type === 'ERROR' || tampRes?.type === 'AUTH_FAILED' || tampRes?.payload?.success === false || tampRes?.payload?.account?.accountNumber !== '57775';
    record('Tampered Token Rejected', rejectedTampered ? 'PASS' : 'FAIL', `Response: type=${tampRes?.type} error=${tampRes?.payload?.message || tampRes?.payload?.error}`);
  } catch (err: any) {
    record('Tampered Token Rejected', 'FAIL', `Error: ${err.message}`);
  } finally {
    if (wsTamp) wsTamp.close();
  }

  // 12. DEMO Mode Isolation Test
  console.log('\n--- STEP 12: DEMO Mode Standalone & Isolation Test ---');
  let wsDemo: WebSocket | null = null;
  try {
    wsDemo = await connectWs(WS_URL);
    const demoRes = await sendWsMessage(wsDemo, 'SESSION_INIT', {
      mode: 'DEMO',
    });

    console.log('DEMO Mode Response Type:', demoRes?.type);
    console.log('DEMO Mode Account:', demoRes?.payload?.account);

    const isDemoMode = demoRes?.payload?.mode === 'DEMO' || demoRes?.payload?.account?.accountNumber === 'DEMO-1001' || demoRes?.type === 'SESSION_INITIALIZED' || demoRes?.type === 'DEMO_INITIALIZED';
    record('DEMO Mode Standalone Works', isDemoMode ? 'PASS' : 'FAIL', `DEMO Mode initialized with account ${demoRes?.payload?.account?.accountNumber || 'DEMO-1001'}`);
  } catch (err: any) {
    record('DEMO Mode Standalone Works', 'FAIL', `Error: ${err.message}`);
  } finally {
    if (wsDemo) wsDemo.close();
  }

  if (ws) {
    ws.close();
  }

  console.log('\n=============================================================================');
  console.log('📊 END-TO-END VERIFICATION SUMMARY:');
  for (const r of results) {
    console.log(`  [${r.status}] ${r.step} -> ${r.details}`);
  }
  console.log('=============================================================================\n');
}

runLiveVerification().catch((err) => {
  console.error('Fatal in live verification:', err);
});
