import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { generateToken, getJwtSecret } from './netlify/functions/middleware/auth';
import { handler } from './netlify/functions/api';
import { inMemoryDb } from './netlify/functions/db/client';
import { TradingRuntimeService } from './src/trading-engine';

process.env.NODE_ENV = 'test';
process.env.CRM_TEST_MODE = 'true';
process.env.CRM_USE_LOCAL_ENGINE = 'true';
process.env.CRM_M2M_SECRET = 'test_only_crm_m2m_secret_at_least_32_characters_long_for_test!';

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

async function runDealerControlPlaneTests() {
  console.log('=============================================================================');
  console.log('🚀 PHASE 2: MANAGER & DEALER CONTROL PLANE AUTOMATED ACCEPTANCE TEST SUITE');
  console.log('=============================================================================\n');

  // Seed default engine state
  TradingRuntimeService.seedDefaultState();

  // Seed in-memory users for auth
  inMemoryDb.users.clear();
  inMemoryDb.auditLogs = [];

  const adminUser = {
    id: 'user-admin-dealer-001',
    email: 'dealer@forexbroker.com',
    password_hash: '$2a$10$hashedpassword',
    role: 'admin' as const,
    status: 'active' as const,
    first_name: 'Chief',
    last_name: 'Dealer',
    country: 'GB',
    preferred_currency: 'USD',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const clientUser = {
    id: 'user-client-trader-001',
    email: 'trader@client.com',
    password_hash: '$2a$10$hashedpassword',
    role: 'client' as const,
    status: 'active' as const,
    first_name: 'Retail',
    last_name: 'Trader',
    country: 'DE',
    preferred_currency: 'EUR',
    created_at: new Date(),
    updated_at: new Date(),
  };

  inMemoryDb.users.set(adminUser.id, adminUser);
  inMemoryDb.users.set(clientUser.id, clientUser);

  const adminToken = generateToken(adminUser);
  const clientToken = generateToken(clientUser);

  // Setup test account with positions & orders in runtime engine
  const targetAccountId = 'acc_uuid_57775_live';

  // Seed two positions on target account
  const pos1 = {
    id: 'pos_ctrl_001',
    accountId: targetAccountId,
    tenantId: 'default',
    orderId: 'ord_init_001',
    symbol: 'EURUSD',
    side: 'BUY' as const,
    volume: 1.5,
    openPrice: 1.085,
    currentPrice: 1.09,
    unrealizedPnL: 75.0,
    realizedPnL: 0,
    marginLocked: 300.0,
    status: 'OPEN' as const,
    openedAt: Date.now() - 3600000,
  };

  const pos2 = {
    id: 'pos_ctrl_002',
    accountId: targetAccountId,
    tenantId: 'default',
    orderId: 'ord_init_002',
    symbol: 'BTCUSD',
    side: 'SELL' as const,
    volume: 0.1,
    openPrice: 65000,
    currentPrice: 64500,
    unrealizedPnL: 50.0,
    realizedPnL: 0,
    marginLocked: 650.0,
    status: 'OPEN' as const,
    openedAt: Date.now() - 1800000,
  };

  TradingRuntimeService.addPosition(pos1);
  TradingRuntimeService.addPosition(pos2);

  const ord1 = {
    id: 'ord_ctrl_001',
    accountId: targetAccountId,
    tenantId: 'default',
    symbol: 'GBPUSD',
    type: 'LIMIT' as const,
    side: 'BUY' as const,
    volume: 0.5,
    price: 1.25,
    requestedPrice: 1.25,
    status: 'WORKING' as const,
    createdAt: Date.now() - 1200000,
  };

  const ord2 = {
    id: 'ord_ctrl_002',
    accountId: targetAccountId,
    tenantId: 'default',
    symbol: 'XAUUSD',
    type: 'STOP' as const,
    side: 'BUY' as const,
    volume: 0.2,
    price: 2350,
    requestedPrice: 2350,
    status: 'PENDING' as const,
    createdAt: Date.now() - 600000,
  };

  TradingRuntimeService.addOrder(ord1);
  TradingRuntimeService.addOrder(ord2);

  // ---------------------------------------------------------------------------
  // [1] Security & RBAC: Admin vs Client Access to Control Plane
  // ---------------------------------------------------------------------------
  console.log('--- [Phase 1] Security & RBAC Protection ---');

  // Unauthenticated call
  const unauthRes: any = await handler(
    {
      path: '/api/admin/trading-control/overview',
      httpMethod: 'GET',
      headers: {},
    } as any,
    {} as any
  );
  assert(unauthRes.statusCode === 401, 'Unauthenticated request to trading-control rejected with HTTP 401');

  // Client role call (Forbidden)
  const clientRes: any = await handler(
    {
      path: '/api/admin/trading-control/overview',
      httpMethod: 'GET',
      headers: { authorization: `Bearer ${clientToken}` },
    } as any,
    {} as any
  );
  assert(clientRes.statusCode === 403, 'Client role request to trading-control rejected with HTTP 403 Forbidden');

  // Admin role call (Authorized)
  const adminOverviewRes: any = await handler(
    {
      path: '/api/admin/trading-control/overview',
      httpMethod: 'GET',
      headers: { authorization: `Bearer ${adminToken}` },
    } as any,
    {} as any
  );
  assert(adminOverviewRes.statusCode === 200, 'Admin request to trading-control overview returns HTTP 200 OK');
  const overviewBody = JSON.parse(adminOverviewRes.body);
  assert(overviewBody.status === 'success', 'Overview status is success');
  assert(overviewBody.data.metrics.openPositionsCount >= 2, 'Overview reports open positions count correctly');
  assert(overviewBody.data.metrics.workingOrdersCount >= 2, 'Overview reports working orders count correctly');
  assert(overviewBody.data.metrics.instrumentsCount === 18, 'Overview reports full 18 instruments catalog');

  // ---------------------------------------------------------------------------
  // [2] Authoritative Account Runtime & Risk Inspection
  // ---------------------------------------------------------------------------
  console.log('\n--- [Phase 2] Authoritative Account Runtime & Risk ---');
  const runtimeRes: any = await handler(
    {
      path: `/api/admin/trading-control/accounts/${targetAccountId}/runtime`,
      httpMethod: 'GET',
      headers: { authorization: `Bearer ${adminToken}` },
    } as any,
    {} as any
  );
  assert(runtimeRes.statusCode === 200, 'GET /accounts/:id/runtime returns HTTP 200');
  const runtimeBody = JSON.parse(runtimeRes.body);
  assert(runtimeBody.data.runtime.accountId === targetAccountId, 'Runtime account ID matches requested target');
  assert(runtimeBody.data.runtime.balance === 50000, 'Authoritative balance reflects Trading Engine state ($50,000)');
  assert(typeof runtimeBody.data.runtime.freeMargin === 'number', 'Authoritative freeMargin returned as number');
  assert(runtimeBody.data.risk.accountId === targetAccountId, 'Risk object returned with account ID');

  // ---------------------------------------------------------------------------
  // [3] Operational Rights & Account Status Update
  // ---------------------------------------------------------------------------
  console.log('\n--- [Phase 3] Account Operational Rights & Status ---');
  const updateStatusRes: any = await handler(
    {
      path: `/api/admin/trading-control/accounts/${targetAccountId}/operational-status`,
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'READ_ONLY',
        tradingEnabled: false,
        reason: 'Risk limit breached; set to READ_ONLY',
      }),
    } as any,
    {} as any
  );
  assert(updateStatusRes.statusCode === 200, 'POST /accounts/:id/operational-status returns HTTP 200');
  const updatedStatusBody = JSON.parse(updateStatusRes.body);
  assert(updatedStatusBody.data.accountStatus === 'READ_ONLY', 'Engine status updated to READ_ONLY');
  assert(updatedStatusBody.data.tradingEnabled === false, 'Engine tradingEnabled set to false');

  // Audit log verification
  const statusAudit = inMemoryDb.auditLogs.find(
    (l) => l.action === 'OPERATIONAL_STATUS_CHANGED' && l.entity_id === targetAccountId
  );
  assert(statusAudit !== undefined, 'Operational status change recorded in Security Audit Trail');

  // Resume status to ACTIVE
  await handler(
    {
      path: `/api/admin/trading-control/accounts/${targetAccountId}/operational-status`,
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'ACTIVE',
        tradingEnabled: true,
        reason: 'Restored active trading status',
      }),
    } as any,
    {} as any
  );

  // ---------------------------------------------------------------------------
  // [4] Positions Blotter Query & Emergency Intervention
  // ---------------------------------------------------------------------------
  console.log('\n--- [Phase 4] Positions Blotter & Intervention ---');
  const posListRes: any = await handler(
    {
      path: `/api/admin/trading-control/positions?accountId=${targetAccountId}`,
      httpMethod: 'GET',
      headers: { authorization: `Bearer ${adminToken}` },
    } as any,
    {} as any
  );
  assert(posListRes.statusCode === 200, 'GET /positions returns HTTP 200');
  const posListBody = JSON.parse(posListRes.body);
  assert(Array.isArray(posListBody.data), 'Positions returned as array');
  assert(posListBody.data.some((p: any) => p.id === 'pos_ctrl_001'), 'Position pos_ctrl_001 discovered');

  // Emergency close single position
  const closePosRes: any = await handler(
    {
      path: `/api/admin/trading-control/positions/pos_ctrl_001/close`,
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Emergency dealer intervention' }),
    } as any,
    {} as any
  );
  assert(closePosRes.statusCode === 200, 'POST /positions/:id/close returns HTTP 200');
  const closePosBody = JSON.parse(closePosRes.body);
  const closedPosition = closePosBody.data.position || closePosBody.data;
  assert(closedPosition.status === 'CLOSED', 'Target position closed on Trading Engine');
  assert(closedPosition.realizedPnL === 75, 'Realized PnL calculated accurately ($75)');

  // Verify Audit Log for position close
  const closeAudit = inMemoryDb.auditLogs.find((l) => l.action === 'POSITION_CLOSED_BY_DEALER');
  assert(closeAudit !== undefined, 'Position close intervention recorded in Security Audit Trail');

  // Emergency close-all remaining positions for account
  const closeAllRes: any = await handler(
    {
      path: `/api/admin/trading-control/accounts/${targetAccountId}/close-all-positions`,
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Account stop-out liquidation' }),
    } as any,
    {} as any
  );
  assert(closeAllRes.statusCode === 200, 'POST /accounts/:id/close-all-positions returns HTTP 200');
  const closeAllBody = JSON.parse(closeAllRes.body);
  assert(closeAllBody.data.closedPositionsCount === 1, 'Closed remaining 1 position pos_ctrl_002');

  // ---------------------------------------------------------------------------
  // [5] Working Order Administration & Cancellation
  // ---------------------------------------------------------------------------
  console.log('\n--- [Phase 5] Working Order Administration ---');
  const ordersListRes: any = await handler(
    {
      path: `/api/admin/trading-control/orders?accountId=${targetAccountId}`,
      httpMethod: 'GET',
      headers: { authorization: `Bearer ${adminToken}` },
    } as any,
    {} as any
  );
  assert(ordersListRes.statusCode === 200, 'GET /orders returns HTTP 200');
  const ordersListBody = JSON.parse(ordersListRes.body);
  assert(ordersListBody.data.some((o: any) => o.id === 'ord_ctrl_001'), 'Order ord_ctrl_001 discovered in order book');

  // Cancel single order
  const cancelOrdRes: any = await handler(
    {
      path: `/api/admin/trading-control/orders/ord_ctrl_001/cancel`,
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Admin price deviation cancellation' }),
    } as any,
    {} as any
  );
  assert(cancelOrdRes.statusCode === 200, 'POST /orders/:id/cancel returns HTTP 200');
  const cancelOrdBody = JSON.parse(cancelOrdRes.body);
  assert(cancelOrdBody.data.order.status === 'CANCELLED', 'Order status is CANCELLED on Trading Engine');

  // Cancel all remaining orders for account
  const cancelAllOrdRes: any = await handler(
    {
      path: `/api/admin/trading-control/accounts/${targetAccountId}/cancel-all-orders`,
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Dealer purge active orders' }),
    } as any,
    {} as any
  );
  assert(cancelAllOrdRes.statusCode === 200, 'POST /accounts/:id/cancel-all-orders returns HTTP 200');
  const cancelAllOrdBody = JSON.parse(cancelAllOrdRes.body);
  assert(cancelAllOrdBody.data.cancelledOrdersCount === 1, 'Cancelled remaining 1 order ord_ctrl_002');

  // ---------------------------------------------------------------------------
  // [6] Executions Journal / Blotter Query
  // ---------------------------------------------------------------------------
  console.log('\n--- [Phase 6] Executions Journal Query ---');
  const execBlotterRes: any = await handler(
    {
      path: '/api/admin/trading-control/executions?limit=10',
      httpMethod: 'GET',
      headers: { authorization: `Bearer ${adminToken}` },
    } as any,
    {} as any
  );
  assert(execBlotterRes.statusCode === 200, 'GET /executions returns HTTP 200');
  const execBlotterBody = JSON.parse(execBlotterRes.body);
  assert(Array.isArray(execBlotterBody.data.executions), 'Executions returned as array in blotter');
  const totalCount = execBlotterBody.data.pagination?.total ?? execBlotterBody.data.total;
  assert(typeof totalCount === 'number', 'Blotter returns total execution count for pagination');

  // ---------------------------------------------------------------------------
  // [7] Market Surveillance & Instrument Circuit Breakers
  // ---------------------------------------------------------------------------
  console.log('\n--- [Phase 7] Market Surveillance & Circuit Breakers ---');
  const instCatalogRes: any = await handler(
    {
      path: '/api/admin/trading-control/instruments',
      httpMethod: 'GET',
      headers: { authorization: `Bearer ${adminToken}` },
    } as any,
    {} as any
  );
  assert(instCatalogRes.statusCode === 200, 'GET /instruments returns HTTP 200');
  const instCatalogBody = JSON.parse(instCatalogRes.body);
  assert(instCatalogBody.data.length === 18, 'Instruments catalog contains all 18 symbols');

  // Halt trading on BTCUSD (Circuit Breaker)
  const haltRes: any = await handler(
    {
      path: '/api/admin/trading-control/instruments/BTCUSD/status',
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'HALTED', reason: 'High volatility circuit breaker' }),
    } as any,
    {} as any
  );
  assert(haltRes.statusCode === 200, 'POST /instruments/BTCUSD/status (HALTED) returns HTTP 200');
  const haltBody = JSON.parse(haltRes.body);
  assert(haltBody.data.tradingStatus === 'HALTED', 'BTCUSD status changed to HALTED');

  // Set close-only on BTCUSD
  const closeOnlyRes: any = await handler(
    {
      path: '/api/admin/trading-control/instruments/BTCUSD/status',
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSE_ONLY', reason: 'Weekend close-only mode' }),
    } as any,
    {} as any
  );
  assert(closeOnlyRes.statusCode === 200, 'POST /instruments/BTCUSD/status (CLOSE_ONLY) returns HTTP 200');
  const closeOnlyBody = JSON.parse(closeOnlyRes.body);
  assert(closeOnlyBody.data.tradingStatus === 'CLOSE_ONLY', 'BTCUSD status changed to CLOSE_ONLY');

  // Resume normal trading
  const resumeRes: any = await handler(
    {
      path: '/api/admin/trading-control/instruments/BTCUSD/status',
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'TRADING', reason: 'Market reopened normally' }),
    } as any,
    {} as any
  );
  assert(resumeRes.statusCode === 200, 'POST /instruments/BTCUSD/status (TRADING) returns HTTP 200');
  const resumeBody = JSON.parse(resumeRes.body);
  assert(resumeBody.data.tradingStatus === 'TRADING', 'BTCUSD status successfully resumed to TRADING');

  // Verify Audit Log for instrument status change
  const instAudit = inMemoryDb.auditLogs.find((l) => l.action === 'INSTRUMENT_STATUS_CHANGED');
  assert(instAudit !== undefined, 'Instrument status changes recorded in Security Audit Trail');

  console.log('\n=============================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 2 DEALER CONTROL PLANE TESTS PASSED!`);
  console.log('=============================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runDealerControlPlaneTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
