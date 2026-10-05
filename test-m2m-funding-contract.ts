// =============================================================================
// TEST SUITE: M2M FUNDING CONTRACT & SIGNING VERIFICATION
// =============================================================================
process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'false'; // Ensure network HTTP path is exercised
process.env.CRM_USE_LOCAL_ENGINE = 'false';
process.env.CRM_M2M_SECRET = 'super_secret_crm_m2m_signing_key_at_least_32_bytes_long_12345';

import assert from 'assert';
import http from 'http';
import express from 'express';
import crypto from 'crypto';
import { TradingEngineBridgeService, FundingBridgeCreditInput } from './netlify/functions/services/trading-engine-bridge.service';

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

async function runM2MFundingContractTests() {
  console.log('=============================================================================');
  console.log('🔐 CRM M2M FUNDING CONTRACT & SIGNATURE VERIFICATION SUITE');
  console.log('=============================================================================\n');

  const secret = process.env.CRM_M2M_SECRET!;
  let lastReceivedRequest: any = null;

  // Spin up an ephemeral HTTP server mimicking the Trading Platform production endpoint
  const app = express();
  app.use(express.raw({ type: 'application/json' }));

  app.post('/api/v1/admin/trading/funding/credit', (req, res) => {
    const rawBody = req.body ? req.body.toString('utf8') : '';
    const timestamp = (req.headers['x-crm-timestamp'] || req.headers['X-CRM-Timestamp']) as string;
    const signature = (req.headers['x-crm-signature'] || req.headers['X-CRM-Signature']) as string;
    const idempotencyKey = (req.headers['idempotency-key'] || req.headers['Idempotency-Key']) as string;

    lastReceivedRequest = {
      headers: req.headers,
      timestamp,
      signature,
      idempotencyKey,
      rawBody,
      jsonBody: rawBody ? JSON.parse(rawBody) : null,
    };

    if (!timestamp || !signature) {
      return res.status(401).json({
        status: 'error',
        code: 'MISSING_M2M_HEADERS',
        message: 'Missing required M2M authentication headers (X-CRM-Timestamp and X-CRM-Signature required)',
      });
    }

    // Verify Base64 HMAC-SHA256
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('base64');

    if (signature !== expectedSig) {
      return res.status(403).json({
        status: 'error',
        code: 'INVALID_SIGNATURE',
        message: 'Invalid M2M signature',
        expected: expectedSig,
        received: signature,
      });
    }

    const body = JSON.parse(rawBody);
    return res.status(200).json({
      status: 'success',
      data: {
        executionId: `exec_${body.transactionId || '123'}`,
        accountId: body.accountId,
        previousBalance: 50000,
        newBalance: 50000 + body.amount,
        executedAt: Date.now(),
      },
    });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const mockEngineUrl = `http://127.0.0.1:${port}`;
  process.env.TRADING_ENGINE_URL = mockEngineUrl;

  try {
    // -------------------------------------------------------------------------
    // 1. SIGNATURE GENERATION UNIT TESTS
    // -------------------------------------------------------------------------
    console.log('--- [Phase 1] Unit Signature & Header Verification ---');
    const ts = Date.now().toString();
    const sampleBody = JSON.stringify({
      accountId: 'acc_crm_123',
      amount: 500.0,
      currency: 'USD',
      transactionId: 'TRF-20261004-9988',
      idempotencyKey: 'idemp_key_12345',
      note: 'Internal Transfer TRF-20261004-9988',
    });

    const sig = TradingEngineBridgeService.generateM2MSignature(secret, ts, sampleBody);
    check(typeof sig === 'string' && sig.length > 0, 'Signature is a non-empty string');
    
    // Validate Base64 regex
    const isBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(sig);
    check(isBase64, 'Signature is strict Base64 encoded');

    // Confirm not old stripe compound format
    check(!sig.startsWith('t='), 'Signature is NOT old stripe compound format (no t=...)');
    check(!sig.includes('v1='), 'Signature does not contain v1= prefix');

    // -------------------------------------------------------------------------
    // 2. LIVE HTTP END-TO-END BRIDGE CALL
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 2] HTTP Outgoing Bridge Call Verification ---');
    const creditInput: FundingBridgeCreditInput = {
      accountId: 'acc_crm_live_57775',
      accountNumber: '57775',
      amount: 750.5,
      currency: 'USD',
      referenceNo: 'TRF-20261004-7788',
      idempotencyKey: 'idemp_stable_key_001',
      transactionId: 'TRF-20261004-7788',
      note: 'Wallet to Trading Account Transfer',
      tenantId: 'default',
    };

    const result = await TradingEngineBridgeService.creditTradingAccount(creditInput);

    check(result.executionId === 'exec_TRF-20261004-7788', 'Execution result received successfully');
    check(result.newBalance === 50750.5, 'New balance correctly calculated by Trading Platform');
    check(result.accountId === 'acc_crm_live_57775', 'Account ID matches in result');

    // -------------------------------------------------------------------------
    // 3. INSPECT HEADERS & EXACT BYTE BODY SENT OVER THE WIRE
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 3] Wire Protocol & Contract Inspection ---');
    check(lastReceivedRequest !== null, 'Request reached mock Trading Platform server');
    check(lastReceivedRequest.timestamp !== undefined, 'X-CRM-Timestamp header is present on wire');
    check(lastReceivedRequest.signature !== undefined, 'X-CRM-Signature header is present on wire');
    check(lastReceivedRequest.idempotencyKey === 'idemp_stable_key_001', 'Idempotency-Key header matches input');

    const wireBody = lastReceivedRequest.jsonBody;
    check(wireBody.accountId === 'acc_crm_live_57775', 'Body contract contains accountId');
    check(wireBody.amount === 750.5, 'Body contract contains amount');
    check(wireBody.currency === 'USD', 'Body contract contains currency');
    check(wireBody.transactionId === 'TRF-20261004-7788', 'Body contract contains transactionId');
    check(wireBody.idempotencyKey === 'idemp_stable_key_001', 'Body contract contains idempotencyKey');
    check(wireBody.note === 'Wallet to Trading Account Transfer', 'Body contract contains note');

    // Confirm no extraneous fields in body
    const bodyKeys = Object.keys(wireBody).sort();
    const expectedKeys = ['accountId', 'amount', 'currency', 'idempotencyKey', 'note', 'transactionId'].sort();
    check(JSON.stringify(bodyKeys) === JSON.stringify(expectedKeys), 'Request body strictly contains only the 6 required contract fields');

    // -------------------------------------------------------------------------
    // 4. IDEMPOTENCY & DETERMINISTIC RETRY STABILITY
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 4] Deterministic Idempotency & Retry Stability ---');
    const firstCallTimestamp = lastReceivedRequest.timestamp;
    const firstCallIdempotencyKey = lastReceivedRequest.idempotencyKey;
    const firstCallTxnId = lastReceivedRequest.jsonBody.transactionId;

    // Retry call with exact same creditInput
    await TradingEngineBridgeService.creditTradingAccount(creditInput);

    check(lastReceivedRequest.idempotencyKey === firstCallIdempotencyKey, 'Idempotency key is deterministic across retries');
    check(lastReceivedRequest.jsonBody.transactionId === firstCallTxnId, 'Transaction ID is deterministic across retries');

    console.log('\n=============================================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} M2M CONTRACT TESTS PASSED`);
    console.log('=============================================================================\n');
  } finally {
    server.close();
  }
}

runM2MFundingContractTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
