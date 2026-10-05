// =============================================================================
// TEST SUITE: STEP 3 — TRADING ENGINE OPERATIONS CONTROL CENTER BACKEND
// =============================================================================
process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';
process.env.CRM_M2M_SECRET = 'test_only_crm_m2m_secret_at_least_32_characters_long_for_test!';

import assert from 'assert';
import http from 'http';
import express from 'express';
import {
  adminTradingRouter,
  TradingRuntimeService,
  AuditService,
  IdempotencyService,
  generateCrmM2MSignature,
} from './src/trading-engine';

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

async function runStep3Tests() {
  console.log('=============================================================================');
  console.log('🚀 STEP 3: TRADING ENGINE OPERATIONS CONTROL CENTER AUTOMATED TEST SUITE');
  console.log('=============================================================================\n');

  // Spin up an ephemeral Express test server
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/trading', adminTradingRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1/admin/trading`;

  const secret = process.env.CRM_M2M_SECRET!;

  // Helper function to call the test server with M2M signing
  async function apiCall(method: string, path: string, body?: any, customHeaders: Record<string, string> = {}) {
    const timestamp = Date.now();
    const sig = generateCrmM2MSignature(secret, timestamp, body);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CRM-Signature': sig,
      ...customHeaders,
    };

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined && method !== 'GET' ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  try {
    // -------------------------------------------------------------------------
    // 1. PUBLIC OBSERVABILITY & HEALTH (PHASE 3.13)
    // -------------------------------------------------------------------------
    console.log('--- [Phase 1] Observability & Health Probing ---');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = await healthRes.json();
    check(healthRes.status === 200, 'GET /health returns 200 without authentication');
    check(healthJson.providers?.tiingo === 'CONNECTED', 'Health probe reports tiingo provider status');
    check(healthJson.providers?.twelve_data === 'CONNECTED', 'Health probe reports twelve_data provider status');

    // -------------------------------------------------------------------------
    // 2. M2M AUTHENTICATION & SECURITY (PHASE 3.1)
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 2] M2M Authentication & Security ---');
    // 2.1 Missing signature
    const noSigRes = await fetch(`${baseUrl}/accounts/acc_57775_live`, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(noSigRes.status === 401, 'Request missing X-CRM-Signature rejected with 401');
    const noSigJson = await noSigRes.json();
    check(noSigJson.code === 'MISSING_SIGNATURE', 'Missing signature returns MISSING_SIGNATURE code');

    // 2.2 Malformed signature
    const malformedRes = await fetch(`${baseUrl}/accounts/acc_57775_live`, {
      headers: { 'Content-Type': 'application/json', 'X-CRM-Signature': 'invalid_format' },
    });
    check(malformedRes.status === 401, 'Malformed signature header rejected with 401');

    // 2.3 Expired timestamp (> 60 seconds ago)
    const oldTimestamp = Date.now() - 120000;
    const oldSig = generateCrmM2MSignature(secret, oldTimestamp);
    const expiredRes = await fetch(`${baseUrl}/accounts/acc_57775_live`, {
      headers: { 'Content-Type': 'application/json', 'X-CRM-Signature': oldSig },
    });
    check(expiredRes.status === 403, 'Expired timestamp (>60s) rejected with 403');
    const expiredJson = await expiredRes.json();
    check(expiredJson.code === 'TIMESTAMP_OUT_OF_BOUNDS', 'Expired timestamp returns TIMESTAMP_OUT_OF_BOUNDS');

    // 2.4 Invalid HMAC signature (wrong secret)
    const wrongSig = generateCrmM2MSignature('wrong_secret_1234567890_abcdefghij!', Date.now());
    const invalidSigRes = await fetch(`${baseUrl}/accounts/acc_57775_live`, {
      headers: { 'Content-Type': 'application/json', 'X-CRM-Signature': wrongSig },
    });
    check(invalidSigRes.status === 403, 'Invalid signature rejected with 403');
    const invalidSigJson = await invalidSigRes.json();
    check(invalidSigJson.code === 'INVALID_SIGNATURE', 'Invalid signature returns INVALID_SIGNATURE');

    // 2.5 Replay rejection
    const replayTimestamp = Date.now();
    const replaySig = generateCrmM2MSignature(secret, replayTimestamp);
    const req1 = await fetch(`${baseUrl}/accounts/acc_57775_live`, {
      headers: { 'Content-Type': 'application/json', 'X-CRM-Signature': replaySig },
    });
    const req2 = await fetch(`${baseUrl}/accounts/acc_57775_live`, {
      headers: { 'Content-Type': 'application/json', 'X-CRM-Signature': replaySig },
    });
    check(req2.status === 403, 'Replayed identical request rejected with 403');
    const req2Json = await req2.json();
    check(req2Json.code === 'REQUEST_REPLAY', 'Replayed request returns REQUEST_REPLAY code');

    // -------------------------------------------------------------------------
    // 3. ACCOUNT RUNTIME & RISK APIS (PHASE 3.3)
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 3] Account Runtime & Risk APIs ---');
    TradingRuntimeService.seedDefaultState();

    const accStateRes = await apiCall('GET', '/accounts/acc_uuid_57775_live');
    check(accStateRes.status === 200, 'GET /accounts/:id returns HTTP 200');
    check(accStateRes.data.accountNumber === '57775', 'Account number matches authoritative runtime state');
    check(accStateRes.data.balance === 50000, 'Initial balance is exactly 50000');
    check(accStateRes.data.equity === 50000, 'Initial equity is exactly 50000');
    check(accStateRes.data.freeMargin === 50000, 'Initial freeMargin matches equity');
    check(accStateRes.data.status === 'ACTIVE', 'Initial account status is ACTIVE');

    const riskRes = await apiCall('GET', '/accounts/acc_uuid_57775_live/risk');
    check(riskRes.status === 200, 'GET /accounts/:id/risk returns HTTP 200');
    check(riskRes.data.canWithdrawAmount === 50000, 'canWithdrawAmount correctly equals freeMargin');
    check(riskRes.data.marginCallLevel === 100, 'marginCallLevel is 100%');
    check(riskRes.data.stopOutLevel === 50, 'stopOutLevel is 50%');

    // Non-existent account
    const notFoundRes = await apiCall('GET', '/accounts/non_existent_account_999');
    check(notFoundRes.status === 404, 'Non-existent account returns HTTP 404');
    check(notFoundRes.data.code === 'ACCOUNT_NOT_FOUND', 'Returns ACCOUNT_NOT_FOUND code');

    // -------------------------------------------------------------------------
    // 4. TENANT ISOLATION (PHASE 3.12)
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 4] Tenant Isolation Enforcement ---');
    const crossTenantRes = await apiCall('GET', '/accounts/acc_uuid_57775_live?tenantId=foreign_tenant_xyz');
    check(crossTenantRes.status === 403, 'Cross-tenant account access rejected with 403');
    check(crossTenantRes.data.code === 'TENANT_ACCESS_DENIED', 'Returns TENANT_ACCESS_DENIED code');

    // -------------------------------------------------------------------------
    // 5. FUNDING EXECUTION APIS (PHASE 3.4)
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 5] Funding Execution (Credit & Debit) ---');
    IdempotencyService.clearMemoryStore();

    // 5.1 Credit account
    const creditPayload = {
      accountId: 'acc_uuid_57775_live',
      accountNumber: '57775',
      amount: 5000.0,
      currency: 'USD',
      referenceNo: 'DEP_REF_1001',
      idempotencyKey: 'idemp_credit_001',
    };
    const creditRes = await apiCall('POST', '/funding/credit', creditPayload, {
      'Idempotency-Key': creditPayload.idempotencyKey,
    });
    check(creditRes.status === 200, 'POST /funding/credit returns HTTP 200');
    check(creditRes.data.status === 'success', 'Credit response status is success');
    check(creditRes.data.previousBalance === 50000, 'previousBalance was 50000');
    check(creditRes.data.newBalance === 55000, 'newBalance is 55000');
    check(creditRes.data.executionId.startsWith('exec_c_'), 'Generates valid unique executionId');

    // 5.2 Duplicate identical credit (Idempotency)
    const dupCreditRes = await apiCall('POST', '/funding/credit', creditPayload, {
      'Idempotency-Key': creditPayload.idempotencyKey,
    });
    check(dupCreditRes.status === 200, 'Duplicate credit returns original HTTP 200');
    check(dupCreditRes.data.newBalance === 55000, 'Duplicate credit returns cached newBalance (no double credit)');

    // Verify balance was NOT double credited
    const accAfterCredit = await apiCall('GET', '/accounts/acc_uuid_57775_live');
    check(accAfterCredit.data.balance === 55000, 'Authoritative balance strictly retained 55000');

    // 5.3 Idempotency conflict (same key, different payload)
    const conflictPayload = { ...creditPayload, amount: 99999.0 };
    const conflictRes = await apiCall('POST', '/funding/credit', conflictPayload, {
      'Idempotency-Key': creditPayload.idempotencyKey,
    });
    check(conflictRes.status === 409, 'Reusing idempotency key with different payload returns 409 Conflict');
    check(conflictRes.data.code === 'IDEMPOTENCY_CONFLICT', 'Returns IDEMPOTENCY_CONFLICT error code');

    // 5.4 Debit account within free margin
    const debitPayload = {
      accountId: 'acc_uuid_57775_live',
      accountNumber: '57775',
      amount: 15000.0,
      currency: 'USD',
      referenceNo: 'WTH_REF_2001',
      idempotencyKey: 'idemp_debit_001',
    };
    const debitRes = await apiCall('POST', '/funding/debit', debitPayload, {
      'Idempotency-Key': debitPayload.idempotencyKey,
    });
    check(debitRes.status === 200, 'POST /funding/debit returns HTTP 200');
    check(debitRes.data.previousBalance === 55000, 'Debit previousBalance was 55000');
    check(debitRes.data.newBalance === 40000, 'Debit newBalance is 40000');

    // 5.5 Debit exceeding free margin
    const excessiveDebit = {
      accountId: 'acc_uuid_57775_live',
      accountNumber: '57775',
      amount: 90000.0,
      currency: 'USD',
      referenceNo: 'WTH_REF_2002',
      idempotencyKey: 'idemp_debit_002',
    };
    const excessiveRes = await apiCall('POST', '/funding/debit', excessiveDebit, {
      'Idempotency-Key': excessiveDebit.idempotencyKey,
    });
    check(excessiveRes.status === 400, 'Debit exceeding free margin rejected with 400 Bad Request');
    check(excessiveRes.data.code === 'INSUFFICIENT_FREE_MARGIN', 'Returns INSUFFICIENT_FREE_MARGIN code');
    check(excessiveRes.data.details?.freeMargin === 40000, 'Details include current available free margin');

    // -------------------------------------------------------------------------
    // 6. POSITIONS ADMINISTRATION (PHASE 3.5)
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 6] Positions Administration ---');
    // Add 2 active positions to account
    TradingRuntimeService.addPosition({
      id: 'pos_test_001',
      accountId: 'acc_uuid_57775_live',
      tenantId: 'default',
      symbol: 'BTCUSD',
      side: 'BUY',
      volume: 1.0,
      openPrice: 85000.0,
      currentPrice: 85200.0,
      unrealizedPnL: 200.0,
      realizedPnL: 0,
      marginLocked: 850.0,
      openedAt: Date.now(),
      status: 'OPEN',
    });

    TradingRuntimeService.addPosition({
      id: 'pos_test_002',
      accountId: 'acc_uuid_57775_live',
      tenantId: 'default',
      symbol: 'ETHUSD',
      side: 'BUY',
      volume: 5.0,
      openPrice: 3000.0,
      currentPrice: 2950.0,
      unrealizedPnL: -250.0,
      realizedPnL: 0,
      marginLocked: 300.0,
      openedAt: Date.now(),
      status: 'OPEN',
    });

    const positionsRes = await apiCall('GET', '/accounts/acc_uuid_57775_live/positions');
    check(positionsRes.status === 200, 'GET /accounts/:id/positions returns HTTP 200');
    check(positionsRes.data.positions.length === 2, 'Returns both open positions');

    // Close single position pos_test_001
    const closeSingleRes = await apiCall('POST', '/positions/pos_test_001/close', {
      adminUserId: 'admin_desk_1',
      reason: 'Client requested phone closure',
    });
    check(closeSingleRes.status === 200, 'POST /positions/:id/close returns HTTP 200');
    check(closeSingleRes.data.position.status === 'CLOSED', 'Position status changed to CLOSED');
    check(closeSingleRes.data.position.realizedPnL === 200, 'Realized PnL is 200');
    check(closeSingleRes.data.execution.type === 'CLOSE', 'Execution record generated for closure');

    // Attempting to close already closed position
    const dupCloseRes = await apiCall('POST', '/positions/pos_test_001/close');
    check(dupCloseRes.status === 400, 'Closing already closed position rejected with 400');
    check(dupCloseRes.data.code === 'POSITION_ALREADY_CLOSED', 'Returns POSITION_ALREADY_CLOSED');

    // Bulk close all remaining positions for account
    const closeAllRes = await apiCall('POST', '/accounts/acc_uuid_57775_live/close-all', {
      adminUserId: 'admin_desk_1',
      reason: 'Emergency margin compliance close',
    });
    check(closeAllRes.status === 200, 'POST /accounts/:id/close-all returns HTTP 200');
    check(closeAllRes.data.closedPositionsCount === 1, 'Closed 1 remaining position (pos_test_002)');

    const remainingPositions = await apiCall('GET', '/accounts/acc_uuid_57775_live/positions');
    check(remainingPositions.data.positions.length === 0, 'No open positions remain after close-all');

    // -------------------------------------------------------------------------
    // 7. ORDER ADMINISTRATION (PHASE 3.6)
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 7] Order Administration ---');
    TradingRuntimeService.addOrder({
      id: 'ord_test_001',
      accountId: 'acc_uuid_57775_live',
      tenantId: 'default',
      symbol: 'BTCUSD',
      side: 'BUY',
      type: 'LIMIT',
      volume: 0.5,
      requestedPrice: 80000.0,
      status: 'WORKING',
      createdAt: Date.now(),
    });

    TradingRuntimeService.addOrder({
      id: 'ord_test_002',
      accountId: 'acc_uuid_57775_live',
      tenantId: 'default',
      symbol: 'ETHUSD',
      side: 'SELL',
      type: 'LIMIT',
      volume: 2.0,
      requestedPrice: 3500.0,
      status: 'PENDING',
      createdAt: Date.now(),
    });

    const ordersRes = await apiCall('GET', '/accounts/acc_uuid_57775_live/orders');
    check(ordersRes.status === 200, 'GET /accounts/:id/orders returns HTTP 200');
    check(ordersRes.data.orders.length === 2, 'Returns active working orders');

    // Cancel single order
    const cancelSingleRes = await apiCall('POST', '/orders/ord_test_001/cancel', {
      adminUserId: 'admin_desk_1',
      reason: 'Stuck order cleanup',
    });
    check(cancelSingleRes.status === 200, 'POST /orders/:id/cancel returns HTTP 200');
    check(cancelSingleRes.data.order.status === 'CANCELLED', 'Order status is CANCELLED');

    // Duplicate cancel
    const dupCancelRes = await apiCall('POST', '/orders/ord_test_001/cancel');
    check(dupCancelRes.status === 400, 'Cancelling already cancelled order rejected with 400');
    check(dupCancelRes.data.code === 'ORDER_ALREADY_CANCELLED', 'Returns ORDER_ALREADY_CANCELLED code');

    // Cancel all orders
    const cancelAllRes = await apiCall('POST', '/accounts/acc_uuid_57775_live/cancel-all-orders');
    check(cancelAllRes.status === 200, 'POST /accounts/:id/cancel-all-orders returns HTTP 200');
    check(cancelAllRes.data.cancelledOrdersCount === 1, 'Cancelled 1 remaining order (ord_test_002)');

    // -------------------------------------------------------------------------
    // 8. EXECUTION QUERY (PHASE 3.7)
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 8] Execution Query ---');
    const execRes = await apiCall('GET', '/executions?accountId=acc_uuid_57775_live');
    check(execRes.status === 200, 'GET /executions returns HTTP 200');
    check(execRes.data.executions.length >= 2, 'Historical executions returned');
    check(execRes.data.pagination.total >= 2, 'Deterministic pagination total returned');

    // -------------------------------------------------------------------------
    // 9. ACCOUNT OPERATIONAL STATUS (PHASE 3.8)
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 9] Account Operational Status ---');
    const suspendRes = await apiCall('POST', '/accounts/acc_uuid_57775_live/status', {
      status: 'SUSPENDED',
      tradingEnabled: false,
      reason: 'Compliance KYC Tier 2 review pending',
      adminUserId: 'compliance_officer_4',
    });
    check(suspendRes.status === 200, 'POST /accounts/:id/status returns HTTP 200');
    check(suspendRes.data.accountStatus === 'SUSPENDED', 'Account status updated to SUSPENDED');
    check(suspendRes.data.tradingEnabled === false, 'tradingEnabled set to false');

    // Verify account runtime state reflects suspension
    const accSuspendedState = await apiCall('GET', '/accounts/acc_uuid_57775_live');
    check(accSuspendedState.data.status === 'SUSPENDED', 'Authoritative state reflects SUSPENDED');
    check(accSuspendedState.data.tradingEnabled === false, 'Authoritative tradingEnabled is false');

    // -------------------------------------------------------------------------
    // 10. INSTRUMENT CONTROL (PHASE 3.9)
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 10] Instrument Control ---');
    const instrumentsRes = await apiCall('GET', '/instruments');
    check(instrumentsRes.status === 200, 'GET /instruments returns HTTP 200');
    check(instrumentsRes.data.instruments.length === 18, 'Returns all 18 instruments catalog');

    // Halt BTCUSD
    const haltRes = await apiCall('POST', '/instruments/BTCUSD/status', {
      status: 'HALTED',
      reason: 'Market provider feed latency spike',
    });
    check(haltRes.status === 200, 'POST /instruments/:symbol/status returns HTTP 200');
    check(haltRes.data.tradingStatus === 'HALTED', 'BTCUSD tradingStatus set to HALTED');

    // Set CLOSE_ONLY
    const closeOnlyRes = await apiCall('POST', '/instruments/BTCUSD/status', {
      status: 'CLOSE_ONLY',
      reason: 'Weekend liquidation mode',
    });
    check(closeOnlyRes.status === 200, 'BTCUSD tradingStatus set to CLOSE_ONLY');
    check(closeOnlyRes.data.tradingStatus === 'CLOSE_ONLY', 'BTCUSD reflects CLOSE_ONLY');

    // -------------------------------------------------------------------------
    // 11. AUDIT TRAIL VERIFICATION (PHASE 3.10)
    // -------------------------------------------------------------------------
    console.log('\n--- [Phase 11] Operations Audit Trail ---');
    const auditLogs = AuditService.getMemoryLogs('acc_uuid_57775_live');
    check(auditLogs.length >= 6, 'Audit logs recorded for each administrative mutation');
    const actionsRecorded = auditLogs.map((l) => l.action);
    check(actionsRecorded.includes('FUNDING_CREDIT'), 'Audit log includes FUNDING_CREDIT');
    check(actionsRecorded.includes('FUNDING_DEBIT'), 'Audit log includes FUNDING_DEBIT');
    check(actionsRecorded.includes('CLOSE_POSITION'), 'Audit log includes CLOSE_POSITION');
    check(actionsRecorded.includes('UPDATE_ACCOUNT_STATUS'), 'Audit log includes UPDATE_ACCOUNT_STATUS');

    // Verify secrets are strictly absent from audit logs
    const serializedAudit = JSON.stringify(auditLogs);
    check(!serializedAudit.includes(secret), 'Audit log contains NO secret keys or signatures');
  } finally {
    server.close();
  }

  console.log('\n=============================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 3 ACCEPTANCE TESTS PASSED SUCCESSFULLY!`);
  console.log('=============================================================================\n');
}

runStep3Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
