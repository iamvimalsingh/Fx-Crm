import { Router, Request, Response } from 'express';
import { verifyCrmM2MRequest } from '../middleware/auth';
import { TradingRuntimeService } from '../services/runtime.service';
import { TradingEngineError } from '../types';

export const adminTradingRouter = Router();

// Standardized error handler helper
function handleRouteError(err: any, res: Response) {
  const timestamp = Date.now();
  if (err instanceof TradingEngineError) {
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
      details: err.details || {},
      timestamp,
    });
  }

  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected runtime error occurred',
    details: {},
    timestamp,
  });
}

// ----------------------------------------------------------------------------
// Public Health Endpoint (Observability Phase 3.13)
// ----------------------------------------------------------------------------
adminTradingRouter.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'trading-platform-engine-step3',
    version: '1.0.0',
    providers: {
      tiingo: 'CONNECTED',
      twelve_data: 'CONNECTED',
    },
    timestamp: Date.now(),
  });
});

// All following routes require M2M HMAC signature authentication
adminTradingRouter.use(verifyCrmM2MRequest);

// ----------------------------------------------------------------------------
// Account Runtime & Risk APIs (Phase 3.3)
// ----------------------------------------------------------------------------
adminTradingRouter.get('/accounts/:accountId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const state = await TradingRuntimeService.getAccountRuntimeState(req.params.accountId, tenantId);
    return res.status(200).json(state);
  } catch (err) {
    return handleRouteError(err, res);
  }
});

adminTradingRouter.get('/accounts/:accountId/risk', async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const risk = await TradingRuntimeService.getAccountRisk(req.params.accountId, tenantId);
    return res.status(200).json(risk);
  } catch (err) {
    return handleRouteError(err, res);
  }
});

// ----------------------------------------------------------------------------
// Account Operational Status (Phase 3.8)
// ----------------------------------------------------------------------------
adminTradingRouter.post('/accounts/:accountId/status', async (req: Request, res: Response) => {
  try {
    const { status, tradingEnabled, reason, tenantId, adminUserId } = req.body;
    if (!status || !['ACTIVE', 'SUSPENDED', 'READ_ONLY'].includes(status)) {
      throw new TradingEngineError('INVALID_STATUS', 'Status must be ACTIVE, SUSPENDED, or READ_ONLY', 400);
    }
    if (typeof tradingEnabled !== 'boolean') {
      throw new TradingEngineError('INVALID_STATUS', 'tradingEnabled boolean is required', 400);
    }

    const updated = await TradingRuntimeService.updateAccountStatus({
      accountId: req.params.accountId,
      status,
      tradingEnabled,
      reason: reason || 'Admin status change',
      tenantId,
      adminUserId,
    });
    return res.status(200).json(updated);
  } catch (err) {
    return handleRouteError(err, res);
  }
});

// ----------------------------------------------------------------------------
// Funding Execution APIs (Phase 3.4)
// ----------------------------------------------------------------------------
adminTradingRouter.post('/funding/credit', async (req: Request, res: Response) => {
  try {
    const idempotencyKey = (req.headers['idempotency-key'] || req.headers['Idempotency-Key'] || req.body.idempotencyKey) as string;
    const { accountId, accountNumber, amount, currency, referenceNo, tenantId, adminUserId } = req.body;

    if (!accountId || !accountNumber || !currency || !referenceNo) {
      throw new TradingEngineError('INVALID_PAYLOAD', 'accountId, accountNumber, amount, currency, referenceNo are required', 400);
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new TradingEngineError('INVALID_AMOUNT', 'amount must be a positive number', 400);
    }

    const result = await TradingRuntimeService.creditAccount({
      accountId,
      accountNumber,
      amount,
      currency,
      referenceNo,
      idempotencyKey,
      tenantId,
      adminUserId,
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    return handleRouteError(err, res);
  }
});

adminTradingRouter.post('/funding/debit', async (req: Request, res: Response) => {
  try {
    const idempotencyKey = (req.headers['idempotency-key'] || req.headers['Idempotency-Key'] || req.body.idempotencyKey) as string;
    const { accountId, accountNumber, amount, currency, referenceNo, tenantId, adminUserId } = req.body;

    if (!accountId || !accountNumber || !currency || !referenceNo) {
      throw new TradingEngineError('INVALID_PAYLOAD', 'accountId, accountNumber, amount, currency, referenceNo are required', 400);
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new TradingEngineError('INVALID_AMOUNT', 'amount must be a positive number', 400);
    }

    const result = await TradingRuntimeService.debitAccount({
      accountId,
      accountNumber,
      amount,
      currency,
      referenceNo,
      idempotencyKey,
      tenantId,
      adminUserId,
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    return handleRouteError(err, res);
  }
});

// ----------------------------------------------------------------------------
// Positions Administration (Phase 3.5)
// ----------------------------------------------------------------------------
adminTradingRouter.get('/accounts/:accountId/positions', async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const positions = await TradingRuntimeService.getPositions(req.params.accountId, tenantId);
    return res.status(200).json({ status: 'success', positions });
  } catch (err) {
    return handleRouteError(err, res);
  }
});

adminTradingRouter.post('/positions/:positionId/close', async (req: Request, res: Response) => {
  try {
    const { adminUserId, reason, tenantId } = req.body || {};
    const result = await TradingRuntimeService.closePosition({
      positionId: req.params.positionId,
      adminUserId,
      reason,
      tenantId,
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleRouteError(err, res);
  }
});

adminTradingRouter.post('/accounts/:accountId/close-all', async (req: Request, res: Response) => {
  try {
    const { adminUserId, reason, tenantId } = req.body || {};
    const result = await TradingRuntimeService.closeAllPositions({
      accountId: req.params.accountId,
      adminUserId,
      reason,
      tenantId,
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleRouteError(err, res);
  }
});

// ----------------------------------------------------------------------------
// Order Administration (Phase 3.6)
// ----------------------------------------------------------------------------
adminTradingRouter.get('/accounts/:accountId/orders', async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const orders = await TradingRuntimeService.getOrders(req.params.accountId, tenantId);
    return res.status(200).json({ status: 'success', orders });
  } catch (err) {
    return handleRouteError(err, res);
  }
});

adminTradingRouter.post('/orders/:orderId/cancel', async (req: Request, res: Response) => {
  try {
    const { adminUserId, reason, tenantId } = req.body || {};
    const result = await TradingRuntimeService.cancelOrder({
      orderId: req.params.orderId,
      adminUserId,
      reason,
      tenantId,
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleRouteError(err, res);
  }
});

adminTradingRouter.post('/accounts/:accountId/cancel-all-orders', async (req: Request, res: Response) => {
  try {
    const { adminUserId, reason, tenantId } = req.body || {};
    const result = await TradingRuntimeService.cancelAllOrders({
      accountId: req.params.accountId,
      adminUserId,
      reason,
      tenantId,
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleRouteError(err, res);
  }
});

// ----------------------------------------------------------------------------
// Execution Query (Phase 3.7)
// ----------------------------------------------------------------------------
adminTradingRouter.get('/executions', async (req: Request, res: Response) => {
  try {
    const filters = {
      accountId: req.query.accountId as string | undefined,
      orderId: req.query.orderId as string | undefined,
      positionId: req.query.positionId as string | undefined,
      symbol: req.query.symbol as string | undefined,
      tenantId: req.query.tenantId as string | undefined,
      startDate: req.query.startDate ? parseInt(req.query.startDate as string, 10) : undefined,
      endDate: req.query.endDate ? parseInt(req.query.endDate as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };
    const result = await TradingRuntimeService.getExecutions(filters);
    return res.status(200).json(result);
  } catch (err) {
    return handleRouteError(err, res);
  }
});

// ----------------------------------------------------------------------------
// Instrument Control (Phase 3.9)
// ----------------------------------------------------------------------------
adminTradingRouter.get('/instruments', async (req: Request, res: Response) => {
  try {
    const instruments = await TradingRuntimeService.getInstruments();
    return res.status(200).json({ status: 'success', instruments });
  } catch (err) {
    return handleRouteError(err, res);
  }
});

adminTradingRouter.post('/instruments/:symbol/status', async (req: Request, res: Response) => {
  try {
    const { status, reason, adminUserId } = req.body;
    if (!status || !['TRADING', 'HALTED', 'CLOSE_ONLY'].includes(status)) {
      throw new TradingEngineError('INVALID_STATUS', 'Status must be TRADING, HALTED, or CLOSE_ONLY', 400);
    }
    const result = await TradingRuntimeService.setInstrumentStatus({
      symbol: req.params.symbol.toUpperCase(),
      status,
      reason: reason || 'Admin instrument status change',
      adminUserId,
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleRouteError(err, res);
  }
});
