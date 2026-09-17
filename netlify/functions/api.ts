import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { AuthService } from './services/auth.service';
import { FinancialService } from './services/financial.service';
import { TradingAccountService } from './services/trading-account.service';
import { KycService } from './services/kyc.service';
import { SupportService } from './services/support.service';
import { NotificationService } from './services/notification.service';
import { StorageService } from './services/storage.service';
import { authenticateRequest, JwtConfigurationError } from './middleware/auth';
import { rateLimiter } from './middleware/rate-limiter';
import {
  DatabaseGuard,
  DatabaseConfigurationError,
  DatabaseConnectionError,
  DatabaseSecurityError,
  getPool,
} from './db/client';
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  CreateDepositSchema,
  ApproveDepositSchema,
  RejectDepositSchema,
  CreateWithdrawalSchema,
  ApproveWithdrawalSchema,
  RejectWithdrawalSchema,
  ManualAdjustmentSchema,
  CreateAccountTransferSchema,
  ApproveAccountTransferSchema,
  RejectAccountTransferSchema,
  RegisterTradingAccountSchema,
  LinkTradingAccountSchema,
  UpdateTradingAccountNicknameSchema,
  RequestLeverageChangeSchema,
  ApproveTradingAccountSchema,
  RejectTradingAccountSchema,
  UpdateTradingAccountStatusSchema,
  AdminUpdateTradingAccountMetadataSchema,
  KycProfileSchema,
  KycReviewSchema,
  KycDocumentUploadSchema,
  CreateSupportTicketSchema,
  ReplySupportTicketSchema,
  UpdateTicketStatusSchema,
} from './middleware/validation';
import { ZodError } from 'zod';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function parseRequestBody(rawBody: string | null): any {
  if (!rawBody || !rawBody.trim()) {
    return {};
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    const err: any = new Error('Invalid JSON payload in request body');
    err.statusCode = 400;
    throw err;
  }
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Parse path (normalizes /.netlify/functions/api/..., /api/..., or duplicate /api/api/...)
  let path = event.path.replace(/^\/\.netlify\/functions\/api/, '').replace(/^(\/api)+/, '');
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // Extract client IP and user agent for audit logging
  const rawIp =
    (event.headers['x-forwarded-for'] as string) ||
    (event.headers['X-Forwarded-For'] as string) ||
    (event.headers['client-ip'] as string) ||
    (event.headers['x-real-ip'] as string) ||
    '127.0.0.1';
  const clientIp = String(rawIp).split(',')[0].trim().substring(0, 100);
  const userAgent = String((event.headers['user-agent'] as string) || 'unknown').substring(0, 500);

  try {
    // -------------------------------------------------------------------------
    // GET /api/health (Safe Database & Infrastructure Diagnostic)
    // -------------------------------------------------------------------------
    if (path === '/health' && event.httpMethod === 'GET') {
      const diagnostic = await DatabaseGuard.getHealthDiagnostic(getPool);
      return {
        statusCode: diagnostic.status === 'ok' ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(diagnostic),
      };
    }

    // Strict Production Database Guard: In-memory fallback is strictly prohibited
    DatabaseGuard.assertDatabaseConfigured();

    // -------------------------------------------------------------------------
    // GET /api/broker/branding (Public Broker Dynamic Branding Configuration)
    // -------------------------------------------------------------------------
    if ((path === '/broker/branding' || path === '/broker-branding') && event.httpMethod === 'GET') {
      const settings = await AuthService.getBrokerSettings();
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'success',
          data: {
            broker_name: settings.broker_name || 'ForexCore Broker',
            legal_entity_name: settings.legal_entity_name || 'ForexCore Financial Services Ltd',
            support_email: settings.support_email || 'support@forexcore.com',
            contact_phone: settings.contact_phone || '+44 20 7946 0912',
            default_currency: settings.default_currency || 'USD',
            default_leverage: settings.default_leverage || '1:100',
            max_leverage: settings.max_leverage || '1:500',
            accent_color: settings.accent_color || '#8b5cf6',
            allowed_registrations: settings.allowed_registrations !== false,
            kyc_required_for_withdrawals: settings.kyc_required_for_withdrawals !== false,
          },
        }),
      };
    }

    // -------------------------------------------------------------------------
    // GET /api/auth/admin-status (Check if initial administrator is initialized)
    // -------------------------------------------------------------------------
    if (path === '/auth/admin-status' && event.httpMethod === 'GET') {
      const hasAdmin = await AuthService.hasAdmin();
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: { initialized: hasAdmin } }),
      };
    }

    // -------------------------------------------------------------------------
    // POST /api/auth/setup-admin (Initial Admin Account Setup)
    // -------------------------------------------------------------------------
    if (path === '/auth/setup-admin' && event.httpMethod === 'POST') {
      const rate = rateLimiter.check(clientIp, 'setup-admin', 5, 60000);
      if (!rate.allowed) {
        return {
          statusCode: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rate.retryAfterSeconds) },
          body: JSON.stringify({ status: 'error', message: `Too many requests. Please try again in ${rate.retryAfterSeconds} seconds.` }),
        };
      }
      const body = parseRequestBody(event.body);
      const validated = RegisterSchema.parse(body);
      const setupSecret =
        body?.setup_secret ||
        (event.headers['x-admin-setup-secret'] as string) ||
        undefined;
      const result = await AuthService.setupAdmin(validated, setupSecret, clientIp, userAgent);
      return {
        statusCode: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: result }),
      };
    }

    // -------------------------------------------------------------------------
    // POST /api/auth/register
    // -------------------------------------------------------------------------
    if (path === '/auth/register' && event.httpMethod === 'POST') {
      const rate = rateLimiter.check(clientIp, 'register', 10, 60000);
      if (!rate.allowed) {
        return {
          statusCode: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rate.retryAfterSeconds) },
          body: JSON.stringify({ status: 'error', message: `Too many registration attempts. Please try again in ${rate.retryAfterSeconds} seconds.` }),
        };
      }
      const body = parseRequestBody(event.body);
      const validated = RegisterSchema.parse(body);
      const result = await AuthService.register(validated, clientIp, userAgent);
      return {
        statusCode: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: result }),
      };
    }

    // -------------------------------------------------------------------------
    // POST /api/auth/login
    // -------------------------------------------------------------------------
    if (path === '/auth/login' && event.httpMethod === 'POST') {
      const rate = rateLimiter.check(clientIp, 'login', 15, 60000);
      if (!rate.allowed) {
        return {
          statusCode: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rate.retryAfterSeconds) },
          body: JSON.stringify({ status: 'error', message: `Too many login attempts. Please try again in ${rate.retryAfterSeconds} seconds.` }),
        };
      }
      const body = parseRequestBody(event.body);
      const validated = LoginSchema.parse(body);
      const result = await AuthService.login(validated, clientIp, userAgent);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: result }),
      };
    }

    // -------------------------------------------------------------------------
    // POST /api/auth/logout
    // -------------------------------------------------------------------------
    if (path === '/auth/logout' && event.httpMethod === 'POST') {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', message: 'Logged out successfully' }),
      };
    }

    // -------------------------------------------------------------------------
    // POST /api/auth/forgot-password
    // -------------------------------------------------------------------------
    if (path === '/auth/forgot-password' && event.httpMethod === 'POST') {
      const rate = rateLimiter.check(clientIp, 'forgot-password', 5, 60000);
      if (!rate.allowed) {
        return {
          statusCode: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rate.retryAfterSeconds) },
          body: JSON.stringify({ status: 'error', message: `Too many requests. Please try again in ${rate.retryAfterSeconds} seconds.` }),
        };
      }
      const body = parseRequestBody(event.body);
      const validated = ForgotPasswordSchema.parse(body);
      const result = await AuthService.forgotPassword(validated, clientIp, userAgent);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: result }),
      };
    }

    // -------------------------------------------------------------------------
    // POST /api/auth/reset-password
    // -------------------------------------------------------------------------
    if (path === '/auth/reset-password' && event.httpMethod === 'POST') {
      const rate = rateLimiter.check(clientIp, 'reset-password', 5, 60000);
      if (!rate.allowed) {
        return {
          statusCode: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rate.retryAfterSeconds) },
          body: JSON.stringify({ status: 'error', message: `Too many requests. Please try again in ${rate.retryAfterSeconds} seconds.` }),
        };
      }
      const body = parseRequestBody(event.body);
      const validated = ResetPasswordSchema.parse(body);
      const result = await AuthService.resetPassword(validated, clientIp, userAgent);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: result }),
      };
    }

    // -------------------------------------------------------------------------
    // GET /api/auth/me (Protected Route - verifies authentication & token)
    // -------------------------------------------------------------------------
    if (path === '/auth/me' && event.httpMethod === 'GET') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Unauthorized. Please log in.' }),
        };
      }
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'success',
          data: {
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              status: user.status,
              first_name: user.first_name,
              last_name: user.last_name,
              preferred_currency: user.preferred_currency,
            },
          },
        }),
      };
    }

    // -------------------------------------------------------------------------
    // GET /api/admin/check (Protected Admin-only Route - tests role guard)
    // -------------------------------------------------------------------------
    if (path === '/admin/check' && event.httpMethod === 'GET') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Unauthorized.' }),
        };
      }
      if (user.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Forbidden. Admin credentials required.' }),
        };
      }
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', message: 'Admin access verified.' }),
      };
    }

    // =========================================================================
    // BROKER BACK OFFICE: CORE OPERATIONS & CLIENT 360 ROUTES
    // =========================================================================

    // GET /api/admin/dashboard/kpis (Core operational aggregate KPIs & urgent queues)
    if (path === '/admin/dashboard/kpis' && event.httpMethod === 'GET') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Unauthorized.' }),
        };
      }
      if (user.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Forbidden. Admin credentials required.' }),
        };
      }
      const data = await AuthService.getDashboardKpis();
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data }),
      };
    }

    // GET /api/admin/clients (Client Directory)
    if (path === '/admin/clients' && event.httpMethod === 'GET') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Unauthorized.' }),
        };
      }
      if (user.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Forbidden. Admin credentials required.' }),
        };
      }
      const search = event.queryStringParameters?.search as string | undefined;
      const status = event.queryStringParameters?.status as string | undefined;
      const kycStatus = event.queryStringParameters?.kycStatus as string | undefined;
      const clients = await AuthService.listClients({ search, status, kycStatus });
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: clients }),
      };
    }

    // GET /api/admin/clients/:id/360 or /api/admin/clients/:id
    const clientMatch = path.match(/^\/admin\/clients\/([^/]+)(\/360)?$/);
    if (clientMatch && event.httpMethod === 'GET') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Unauthorized.' }),
        };
      }
      if (user.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Forbidden. Admin credentials required.' }),
        };
      }
      const clientId = clientMatch[1];
      const profile = await AuthService.getClient360(clientId);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: profile }),
      };
    }

    // PATCH /api/admin/clients/:id/status (Suspend / Reactivate Client)
    const clientStatusMatch = path.match(/^\/admin\/clients\/([^/]+)\/status$/);
    if (clientStatusMatch && event.httpMethod === 'PATCH') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Unauthorized.' }),
        };
      }
      if (user.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Forbidden. Admin credentials required.' }),
        };
      }
      const clientId = clientStatusMatch[1];
      const body = parseRequestBody(event.body);
      const targetStatus = body.status;
      if (!targetStatus || !['active', 'suspended', 'pending'].includes(targetStatus)) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Invalid status. Must be active, suspended, or pending.' }),
        };
      }
      const res = await AuthService.updateClientStatus(
        user.id,
        clientId,
        targetStatus,
        body.reason,
        clientIp,
        userAgent
      );
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: res }),
      };
    }

    // DELETE /api/admin/clients/:id (Admin Client Deletion / Deactivation)
    const clientDeleteMatch = path.match(/^\/admin\/clients\/([^/]+)$/);
    if (clientDeleteMatch && event.httpMethod === 'DELETE') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Unauthorized.' }),
        };
      }
      if (user.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Forbidden. Admin credentials required.' }),
        };
      }
      const clientId = clientDeleteMatch[1];
      const body = parseRequestBody(event.body);
      const res = await AuthService.deleteClient(
        user.id,
        clientId,
        { confirmEmail: body?.confirmEmail },
        clientIp,
        userAgent
      );
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', ...res }),
      };
    }

    // POST /api/admin/notifications/broadcast
    if (path === '/admin/notifications/broadcast' && event.httpMethod === 'POST') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user || user.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Admin access required.' }),
        };
      }
      const body = parseRequestBody(event.body);
      const res = await AuthService.broadcastNotification(
        user.id,
        {
          title: body.title,
          message: body.message,
          type: body.type || 'system',
          target: body.target || 'all',
          user_id: body.user_id,
        },
        clientIp,
        userAgent
      );
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: res }),
      };
    }

    // GET /api/admin/broker-settings
    if (path === '/admin/broker-settings' && event.httpMethod === 'GET') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user || user.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Admin access required.' }),
        };
      }
      const settings = await AuthService.getBrokerSettings();
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: settings }),
      };
    }

    // POST /api/admin/broker-settings
    if (path === '/admin/broker-settings' && event.httpMethod === 'POST') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user || user.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Admin access required.' }),
        };
      }
      const body = parseRequestBody(event.body);
      const updated = await AuthService.updateBrokerSettings(body, user.id, clientIp, userAgent);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: updated }),
      };
    }

    // -------------------------------------------------------------------------
    // GET /api/admin/staff (List all staff administrators)
    // -------------------------------------------------------------------------
    if (path === '/admin/staff' && event.httpMethod === 'GET') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user || user.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Admin access required.' }),
        };
      }
      const admins = await AuthService.listStaffAdmins();
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: admins }),
      };
    }

    // -------------------------------------------------------------------------
    // POST /api/admin/staff (Provision new staff administrator)
    // -------------------------------------------------------------------------
    if (path === '/admin/staff' && event.httpMethod === 'POST') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user || user.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Admin access required.' }),
        };
      }
      const body = parseRequestBody(event.body);
      const newAdmin = await AuthService.createStaffAdmin(
        user.id,
        {
          email: body.email,
          password: body.password,
          first_name: body.first_name,
          last_name: body.last_name,
        },
        clientIp,
        userAgent
      );
      return {
        statusCode: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: newAdmin }),
      };
    }

    // -------------------------------------------------------------------------
    // POST /api/admin/staff/status (Activate / Deactivate staff administrator)
    // -------------------------------------------------------------------------
    if (path === '/admin/staff/status' && event.httpMethod === 'POST') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await authenticateRequest(authHeader);
      if (!user || user.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Admin access required.' }),
        };
      }
      const body = parseRequestBody(event.body);
      const result = await AuthService.setStaffAdminStatus(
        user.id,
        body.admin_id,
        body.status,
        body.reason,
        clientIp,
        userAgent
      );
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: result }),
      };
    }

    // =========================================================================
    // FINANCIAL CRM MODULE ROUTES
    // =========================================================================

    // -------------------------------------------------------------------------
    // GET /api/financial/payment-methods (Public or Authenticated)
    // -------------------------------------------------------------------------
    if (path === '/financial/payment-methods' && event.httpMethod === 'GET') {
      const type = event.queryStringParameters?.type as 'deposit' | 'withdrawal' | undefined;
      const methods = await FinancialService.getPaymentMethods(type);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: methods }),
      };
    }

    // Protected Financial Routes require authentication:
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const authUser = await authenticateRequest(authHeader);

    if (!authUser && path.startsWith('/financial/')) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'error', message: 'Authentication required for financial operations.' }),
      };
    }

    // -------------------------------------------------------------------------
    // GET /api/financial/wallet (Current User's Wallet with exact decimal balances)
    // -------------------------------------------------------------------------
    if (path === '/financial/wallet' && event.httpMethod === 'GET' && authUser) {
      const currency = (event.queryStringParameters?.currency as string) || 'USD';
      // Admin can optionally query a specific user's wallet via ?user_id=...
      const targetUserId =
        authUser.role === 'admin' && event.queryStringParameters?.user_id
          ? event.queryStringParameters.user_id
          : authUser.id;

      const wallet = await FinancialService.getOrCreateWallet(targetUserId, currency);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: wallet }),
      };
    }

    // -------------------------------------------------------------------------
    // POST /api/financial/deposits (Client submits deposit request)
    // -------------------------------------------------------------------------
    if (path === '/financial/deposits' && event.httpMethod === 'POST' && authUser) {
      const body = parseRequestBody(event.body);
      const validated = CreateDepositSchema.parse(body);
      const deposit = await FinancialService.createDeposit(authUser.id, validated, clientIp, userAgent);
      return {
        statusCode: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: deposit }),
      };
    }

    // -------------------------------------------------------------------------
    // GET /api/financial/deposits (List deposits: client gets own, admin can see all)
    // -------------------------------------------------------------------------
    if (path === '/financial/deposits' && event.httpMethod === 'GET' && authUser) {
      const status = event.queryStringParameters?.status as string | undefined;
      const targetUserId =
        authUser.role === 'admin'
          ? (event.queryStringParameters?.user_id as string | undefined)
          : authUser.id;

      const deposits = await FinancialService.listDeposits({
        userId: targetUserId,
        status,
        limit: 100,
      });

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: deposits }),
      };
    }

    // -------------------------------------------------------------------------
    // POST /api/financial/withdrawals (Client creates withdrawal & reserves balance)
    // -------------------------------------------------------------------------
    if (path === '/financial/withdrawals' && event.httpMethod === 'POST' && authUser) {
      const body = parseRequestBody(event.body);
      const validated = CreateWithdrawalSchema.parse(body);
      const result = await FinancialService.createWithdrawal(authUser.id, validated, clientIp, userAgent);
      return {
        statusCode: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: result }),
      };
    }

    // -------------------------------------------------------------------------
    // GET /api/financial/withdrawals (List withdrawals: client gets own, admin sees all)
    // -------------------------------------------------------------------------
    if (path === '/financial/withdrawals' && event.httpMethod === 'GET' && authUser) {
      const status = event.queryStringParameters?.status as string | undefined;
      const targetUserId =
        authUser.role === 'admin'
          ? (event.queryStringParameters?.user_id as string | undefined)
          : authUser.id;

      const withdrawals = await FinancialService.listWithdrawals({
        userId: targetUserId,
        status,
        limit: 100,
      });

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: withdrawals }),
      };
    }

    // -------------------------------------------------------------------------
    // POST /api/financial/withdrawals/:id/cancel (Cancel pending withdrawal)
    // -------------------------------------------------------------------------
    const cancelMatch = path.match(/^\/financial\/withdrawals\/([^/]+)\/cancel$/);
    if (cancelMatch && event.httpMethod === 'POST' && authUser) {
      const withdrawalId = cancelMatch[1];
      const result = await FinancialService.cancelWithdrawal(
        withdrawalId,
        authUser.id,
        authUser.role === 'admin',
        clientIp,
        userAgent
      );
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: result }),
      };
    }

    // -------------------------------------------------------------------------
    // GET /api/financial/transactions (Immutable Ledger records)
    // -------------------------------------------------------------------------
    if (path === '/financial/transactions' && event.httpMethod === 'GET' && authUser) {
      const type = event.queryStringParameters?.type as string | undefined;
      const targetUserId =
        authUser.role === 'admin'
          ? (event.queryStringParameters?.user_id as string | undefined)
          : authUser.id;

      const transactions = await FinancialService.listTransactions({
        userId: targetUserId,
        type,
        limit: 100,
      });

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: transactions }),
      };
    }

    // -------------------------------------------------------------------------
    // POST /api/financial/transfers (Client creates transfer: Wallet <-> Trading Account)
    // -------------------------------------------------------------------------
    if (path === '/financial/transfers' && event.httpMethod === 'POST' && authUser) {
      const body = parseRequestBody(event.body);
      const validated = CreateAccountTransferSchema.parse(body);
      const result = await FinancialService.createAccountTransfer(authUser.id, validated, clientIp, userAgent);
      return {
        statusCode: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: result }),
      };
    }

    // -------------------------------------------------------------------------
    // GET /api/financial/transfers (List transfers: client gets own, admin sees all/filtered)
    // -------------------------------------------------------------------------
    if (path === '/financial/transfers' && event.httpMethod === 'GET' && authUser) {
      const status = event.queryStringParameters?.status as string | undefined;
      const tradingAccountId = event.queryStringParameters?.trading_account_id as string | undefined;
      const targetUserId =
        authUser.role === 'admin'
          ? (event.queryStringParameters?.user_id as string | undefined)
          : authUser.id;

      const transfers = await FinancialService.getAccountTransfers({
        userId: targetUserId,
        status,
        tradingAccountId,
      });

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'success', data: transfers }),
      };
    }

    // -------------------------------------------------------------------------
    // ADMIN ONLY FINANCIAL ROUTES (Require role: 'admin')
    // -------------------------------------------------------------------------
    if (path.startsWith('/financial/admin/')) {
      if (!authUser || authUser.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Forbidden. Admin privileges required.' }),
        };
      }

      // POST /api/financial/admin/deposits/:id/approve
      const approveDepMatch = path.match(/^\/financial\/admin\/deposits\/([^/]+)\/approve$/);
      if (approveDepMatch && event.httpMethod === 'POST') {
        const depositId = approveDepMatch[1];
        const body = parseRequestBody(event.body);
        const validated = ApproveDepositSchema.parse(body);
        const result = await FinancialService.approveDeposit(depositId, authUser.id, validated, clientIp, userAgent);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result }),
        };
      }

      // POST /api/financial/admin/deposits/:id/reject
      const rejectDepMatch = path.match(/^\/financial\/admin\/deposits\/([^/]+)\/reject$/);
      if (rejectDepMatch && event.httpMethod === 'POST') {
        const depositId = rejectDepMatch[1];
        const body = parseRequestBody(event.body);
        const validated = RejectDepositSchema.parse(body);
        const result = await FinancialService.rejectDeposit(depositId, authUser.id, validated, clientIp, userAgent);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result }),
        };
      }

      // POST /api/financial/admin/withdrawals/:id/approve
      const approveWthMatch = path.match(/^\/financial\/admin\/withdrawals\/([^/]+)\/approve$/);
      if (approveWthMatch && event.httpMethod === 'POST') {
        const withdrawalId = approveWthMatch[1];
        const body = parseRequestBody(event.body);
        const validated = ApproveWithdrawalSchema.parse(body);
        const result = await FinancialService.approveWithdrawal(withdrawalId, authUser.id, validated, clientIp, userAgent);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result }),
        };
      }

      // POST /api/financial/admin/withdrawals/:id/reject
      const rejectWthMatch = path.match(/^\/financial\/admin\/withdrawals\/([^/]+)\/reject$/);
      if (rejectWthMatch && event.httpMethod === 'POST') {
        const withdrawalId = rejectWthMatch[1];
        const body = parseRequestBody(event.body);
        const validated = RejectWithdrawalSchema.parse(body);
        const result = await FinancialService.rejectWithdrawal(withdrawalId, authUser.id, validated, clientIp, userAgent);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result }),
        };
      }

      // POST /api/financial/admin/transfers/:id/approve
      const approveTrfMatch = path.match(/^\/financial\/admin\/transfers\/([^/]+)\/approve$/);
      if (approveTrfMatch && event.httpMethod === 'POST') {
        const transferId = approveTrfMatch[1];
        const body = parseRequestBody(event.body);
        const validated = ApproveAccountTransferSchema.parse(body);
        const result = await FinancialService.approveAccountTransfer(transferId, authUser.id, validated, clientIp, userAgent);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result }),
        };
      }

      // POST /api/financial/admin/transfers/:id/reject
      const rejectTrfMatch = path.match(/^\/financial\/admin\/transfers\/([^/]+)\/reject$/);
      if (rejectTrfMatch && event.httpMethod === 'POST') {
        const transferId = rejectTrfMatch[1];
        const body = parseRequestBody(event.body);
        const validated = RejectAccountTransferSchema.parse(body);
        const result = await FinancialService.rejectAccountTransfer(transferId, authUser.id, validated, clientIp, userAgent);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result }),
        };
      }

      // POST /api/financial/admin/adjustments
      if (path === '/financial/admin/adjustments' && event.httpMethod === 'POST') {
        const body = parseRequestBody(event.body);
        const validated = ManualAdjustmentSchema.parse(body);
        const result = await FinancialService.manualAdjustment(authUser.id, validated, clientIp, userAgent);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result }),
        };
      }

      // GET /api/financial/admin/audit-logs
      if (path === '/financial/admin/audit-logs' && event.httpMethod === 'GET') {
        const targetType = event.queryStringParameters?.target_type as string | undefined;
        const targetId = event.queryStringParameters?.target_id as string | undefined;
        const logs = await FinancialService.listAuditLogs({
          targetType,
          targetId,
          limit: 100,
        });
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: logs }),
        };
      }
    }

    // =========================================================================
    // TRADING ACCOUNT REGISTRY MODULE ROUTES (Strictly isolated from financial ledger)
    // =========================================================================
    const isTradingAccountRoute =
      path.startsWith('/trading-accounts') ||
      path.startsWith('/admin/trading-accounts') ||
      path.startsWith('/admin/trading-password-resets');

    if (isTradingAccountRoute) {
      if (!authUser) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Authentication required.' }),
        };
      }

      // Admin routes role authorization guard
      if (
        (path.startsWith('/admin/trading-accounts') || path.startsWith('/admin/trading-password-resets')) &&
        authUser.role !== 'admin'
      ) {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Forbidden. Admin credentials required.' }),
        };
      }

      // GET /api/trading-accounts (List own accounts)
      if (path === '/trading-accounts' && event.httpMethod === 'GET') {
        const accounts = await TradingAccountService.getUserAccounts(authUser.id);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: accounts }),
        };
      }

      // POST /api/trading-accounts/register (Register new account)
      if (path === '/trading-accounts/register' && event.httpMethod === 'POST') {
        const body = parseRequestBody(event.body);
        const validated = RegisterTradingAccountSchema.parse(body);
        const account = await TradingAccountService.registerAccount(
          authUser.id,
          validated,
          clientIp,
          userAgent
        );
        return {
          statusCode: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: account }),
        };
      }

      // POST /api/trading-accounts/link (Link existing trading account)
      if (path === '/trading-accounts/link' && event.httpMethod === 'POST') {
        const body = parseRequestBody(event.body);
        const validated = LinkTradingAccountSchema.parse(body);
        const account = await TradingAccountService.linkExistingAccount(
          authUser.id,
          validated,
          clientIp,
          userAgent
        );
        return {
          statusCode: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: account }),
        };
      }

      // PATCH /api/trading-accounts/:id/nickname (Update nickname with IDOR protection)
      const nicknameMatch = path.match(/^\/trading-accounts\/([^/]+)\/nickname$/);
      if (nicknameMatch && event.httpMethod === 'PATCH') {
        const accountId = nicknameMatch[1];
        const body = parseRequestBody(event.body);
        const validated = UpdateTradingAccountNicknameSchema.parse(body);
        const account = await TradingAccountService.updateUserAccountNickname(
          authUser.id,
          accountId,
          validated.nickname,
          clientIp,
          userAgent
        );
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: account }),
        };
      }

      // POST /api/trading-accounts/:id/request-leverage (Request leverage change with IDOR protection)
      const leverageReqMatch = path.match(/^\/trading-accounts\/([^/]+)\/request-leverage$/);
      if (leverageReqMatch && event.httpMethod === 'POST') {
        const accountId = leverageReqMatch[1];
        const body = parseRequestBody(event.body);
        const validated = RequestLeverageChangeSchema.parse(body);
        const result = await TradingAccountService.requestLeverageChange(
          authUser.id,
          accountId,
          validated.requested_leverage,
          validated.reason,
          clientIp,
          userAgent
        );
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result }),
        };
      }

      // GET /api/trading-accounts/:id (Account detail with IDOR protection)
      const userAccountDetailMatch = path.match(/^\/trading-accounts\/([^/]+)$/);
      if (userAccountDetailMatch && event.httpMethod === 'GET') {
        const accountId = userAccountDetailMatch[1];
        const account = await TradingAccountService.getUserAccountById(authUser.id, accountId);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: account }),
        };
      }

      // Admin: GET /api/admin/trading-accounts (List all accounts with filters)
      if (path === '/admin/trading-accounts' && event.httpMethod === 'GET') {
        const accounts = await TradingAccountService.getAllAccountsAdmin({
          status: event.queryStringParameters?.status,
          platform: event.queryStringParameters?.platform,
          search: event.queryStringParameters?.search,
          user_id: event.queryStringParameters?.user_id,
        });
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: accounts }),
        };
      }

      // Admin: POST /api/admin/trading-accounts/:id/approve
      const approveMatch = path.match(/^\/admin\/trading-accounts\/([^/]+)\/approve$/);
      if (approveMatch && event.httpMethod === 'POST') {
        const accountId = approveMatch[1];
        const body = parseRequestBody(event.body);
        const validated = ApproveTradingAccountSchema.parse(body);
        const account = await TradingAccountService.approveAccount(
          authUser.id,
          accountId,
          validated,
          clientIp,
          userAgent
        );
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: account }),
        };
      }

      // Admin: POST /api/admin/trading-accounts/:id/reject
      const rejectMatch = path.match(/^\/admin\/trading-accounts\/([^/]+)\/reject$/);
      if (rejectMatch && event.httpMethod === 'POST') {
        const accountId = rejectMatch[1];
        const body = parseRequestBody(event.body);
        const validated = RejectTradingAccountSchema.parse(body);
        const account = await TradingAccountService.rejectAccount(
          authUser.id,
          accountId,
          validated,
          clientIp,
          userAgent
        );
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: account }),
        };
      }

      // Admin: PATCH /api/admin/trading-accounts/:id/status
      const statusMatch = path.match(/^\/admin\/trading-accounts\/([^/]+)\/status$/);
      if (statusMatch && event.httpMethod === 'PATCH') {
        const accountId = statusMatch[1];
        const body = parseRequestBody(event.body);
        const validated = UpdateTradingAccountStatusSchema.parse(body);
        const account = await TradingAccountService.updateAccountStatus(
          authUser.id,
          accountId,
          validated.status,
          validated.admin_notes,
          clientIp,
          userAgent
        );
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: account }),
        };
      }

      // Admin: PATCH /api/admin/trading-accounts/:id/metadata
      const metadataMatch = path.match(/^\/admin\/trading-accounts\/([^/]+)\/metadata$/);
      if (metadataMatch && event.httpMethod === 'PATCH') {
        const accountId = metadataMatch[1];
        const body = parseRequestBody(event.body);
        const validated = AdminUpdateTradingAccountMetadataSchema.parse(body);
        const account = await TradingAccountService.updateMetadataAdmin(
          authUser.id,
          accountId,
          validated,
          clientIp,
          userAgent
        );
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: account }),
        };
      }

      // Admin: GET /api/admin/trading-accounts/:id (Account detail with owner and audit trail)
      const adminDetailMatch = path.match(/^\/admin\/trading-accounts\/([^/]+)$/);
      if (adminDetailMatch && event.httpMethod === 'GET') {
        const accountId = adminDetailMatch[1];
        const detail = await TradingAccountService.getAccountByIdAdmin(accountId);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: detail }),
        };
      }

      // Admin: DELETE /api/admin/trading-accounts/:id (Delete or archive trading account)
      if (adminDetailMatch && event.httpMethod === 'DELETE') {
        const accountId = adminDetailMatch[1];
        const result = await TradingAccountService.deleteAccountAdmin(
          authUser.id,
          accountId,
          clientIp,
          userAgent
        );
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', ...result }),
        };
      }

      // Admin: POST /api/admin/trading-accounts/:id/assign (Assign / Map trading account to client)
      const adminAssignMatch = path.match(/^\/admin\/trading-accounts\/([^/]+)\/assign$/);
      if (adminAssignMatch && event.httpMethod === 'POST') {
        const accountId = adminAssignMatch[1];
        const body = parseRequestBody(event.body);
        if (!body?.target_client_id) {
          return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'error', message: 'target_client_id is required' }),
          };
        }
        const updated = await TradingAccountService.assignAccountToClientAdmin(
          authUser.id,
          accountId,
          body.target_client_id,
          clientIp,
          userAgent
        );
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: updated, message: 'Trading account successfully assigned to client.' }),
        };
      }

      // Client: POST /api/trading-accounts/:id/password-reset (Request trading password reset)
      const passwordResetReqMatch = path.match(/^\/trading-accounts\/([^/]+)\/password-reset$/);
      if (passwordResetReqMatch && event.httpMethod === 'POST') {
        const accountId = passwordResetReqMatch[1];
        const body = parseRequestBody(event.body);
        const result = await TradingAccountService.requestPasswordReset(
          authUser.id,
          accountId,
          body?.reason,
          clientIp,
          userAgent
        );
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result, message: 'Password reset request submitted for administrative review.' }),
        };
      }

      // Client: GET /api/trading-accounts/password-resets (List own password reset requests)
      if (path === '/trading-accounts/password-resets' && event.httpMethod === 'GET') {
        const resets = await TradingAccountService.getUserPasswordResets(authUser.id);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: resets }),
        };
      }

      // Admin: GET /api/admin/trading-password-resets (List all password reset requests)
      if (path === '/admin/trading-password-resets' && event.httpMethod === 'GET') {
        const status = event.queryStringParameters?.status;
        const search = event.queryStringParameters?.search;
        const list = await TradingAccountService.getAllPasswordResetsAdmin({ status, search });
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: list }),
        };
      }

      // Admin: POST /api/admin/trading-password-resets/:id/process (Approve or Reject reset request)
      const processResetMatch = path.match(/^\/admin\/trading-password-resets\/([^/]+)\/process$/);
      if (processResetMatch && event.httpMethod === 'POST') {
        const requestId = processResetMatch[1];
        const body = parseRequestBody(event.body);
        if (!body?.action || !['approve', 'reject'].includes(body.action)) {
          return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'error', message: "Action must be 'approve' or 'reject'" }),
          };
        }
        const result = await TradingAccountService.processPasswordResetAdmin(
          authUser.id,
          requestId,
          body.action,
          {
            new_password: body.new_password,
            admin_notes: body.admin_notes,
            rejection_reason: body.rejection_reason,
          },
          clientIp,
          userAgent
        );
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', ...result }),
        };
      }
    }

    // =========================================================================
    // PERSISTENT DOCUMENT PREVIEW / DOWNLOAD ROUTE
    // =========================================================================
    if (path === '/documents/preview' && event.httpMethod === 'GET') {
      if (!authUser) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Authentication required to access documents' }),
        };
      }

      const key = event.queryStringParameters?.key as string;
      if (!key) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Document key is required' }),
        };
      }

      // Strict IDOR Protection: Non-admin users can ONLY view their own documents
      if (authUser.role !== 'admin' && !key.includes(`/${authUser.id}/`)) {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Unauthorized: Access to this document is denied' }),
        };
      }

      const testFile = StorageService.getTestFile(key);
      if (testFile) {
        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': testFile.mimeType,
            'Content-Disposition': `inline; filename="${encodeURIComponent(StorageService.sanitizeFilename(key))}"`,
          },
          isBase64Encoded: true,
          body: testFile.buffer.toString('base64'),
        };
      }

      // If in production S3, generate pre-signed redirect URL
      const signedUrl = await StorageService.getDownloadUrl(key, 300);
      return {
        statusCode: 302,
        headers: {
          ...corsHeaders,
          Location: signedUrl,
        },
        body: '',
      };
    }

    // =========================================================================
    // NOTIFICATIONS MODULE ROUTES
    // =========================================================================
    if (path.startsWith('/notifications')) {
      if (!authUser) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Authentication required' }),
        };
      }

      // GET /api/notifications (Fetch user notifications)
      if (path === '/notifications' && event.httpMethod === 'GET') {
        const limit = parseInt((event.queryStringParameters?.limit as string) || '30', 10);
        const offset = parseInt((event.queryStringParameters?.offset as string) || '0', 10);
        const result = await NotificationService.getUserNotifications(authUser.id, limit, offset);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result }),
        };
      }

      // POST /api/notifications/read (Mark single notification read)
      if (path === '/notifications/read' && event.httpMethod === 'POST') {
        const body = parseRequestBody(event.body);
        if (!body.notification_id) {
          return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'error', message: 'notification_id is required' }),
          };
        }
        const updated = await NotificationService.markAsRead(body.notification_id, authUser.id);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: { success: updated } }),
        };
      }

      // POST /api/notifications/read-all (Mark all user notifications read)
      if (path === '/notifications/read-all' && event.httpMethod === 'POST') {
        const count = await NotificationService.markAllAsRead(authUser.id);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: { marked_count: count } }),
        };
      }
    }

    // =========================================================================
    // KYC MODULE ROUTES (CLIENT & ADMIN)
    // =========================================================================
    if (path.startsWith('/kyc')) {
      if (!authUser) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Authentication required' }),
        };
      }

      // GET /api/kyc/profile (Client gets their own KYC profile & documents)
      if (path === '/kyc/profile' && event.httpMethod === 'GET') {
        const profile = await KycService.getProfileByUserId(authUser.id);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: profile }),
        };
      }

      // POST /api/kyc/profile (Client submits or resubmits KYC personal information)
      if (path === '/kyc/profile' && event.httpMethod === 'POST') {
        const body = parseRequestBody(event.body);
        const validated = KycProfileSchema.parse(body);
        const profile = await KycService.submitProfile(authUser.id, validated, clientIp, userAgent);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: profile }),
        };
      }

      // POST /api/kyc/documents (Client uploads verification document)
      if (path === '/kyc/documents' && event.httpMethod === 'POST') {
        const body = parseRequestBody(event.body);
        const validated = KycDocumentUploadSchema.parse(body);
        const buffer = Buffer.from(validated.file_base64, 'base64');
        const document = await KycService.uploadDocument(
          authUser.id,
          validated.document_type,
          validated.original_filename,
          validated.mime_type,
          buffer,
          clientIp,
          userAgent
        );
        return {
          statusCode: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: document }),
        };
      }

      // DELETE /api/kyc/documents/:id (Client deletes a pending or rejected document)
      const docDeleteMatch = path.match(/^\/kyc\/documents\/([^/]+)$/);
      if (docDeleteMatch && event.httpMethod === 'DELETE') {
        const docId = docDeleteMatch[1];
        await KycService.deleteDocument(docId, authUser.id, clientIp, userAgent);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', message: 'Document deleted successfully' }),
        };
      }
    }

    // Admin KYC Routes
    if (path.startsWith('/admin/kyc')) {
      if (!authUser) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Authentication required' }),
        };
      }
      if (authUser.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Forbidden. Admin credentials required.' }),
        };
      }

      // GET /api/admin/kyc (List applications queue)
      if (path === '/admin/kyc' && event.httpMethod === 'GET') {
        const status = event.queryStringParameters?.status as string | undefined;
        const page = parseInt((event.queryStringParameters?.page as string) || '1', 10);
        const limit = parseInt((event.queryStringParameters?.limit as string) || '20', 10);
        const result = await KycService.listProfilesAdmin(status, page, limit);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result }),
        };
      }

      // GET /api/admin/kyc/:id (Get application details and documents)
      const adminKycDetailMatch = path.match(/^\/admin\/kyc\/([^/]+)$/);
      if (adminKycDetailMatch && event.httpMethod === 'GET') {
        const profileId = adminKycDetailMatch[1];
        const profile = await KycService.getProfileById(profileId);
        if (!profile) {
          return {
            statusCode: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'error', message: 'KYC application not found' }),
          };
        }
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: profile }),
        };
      }

      // POST /api/admin/kyc/:id/review (Approve / Reject application)
      const adminKycReviewMatch = path.match(/^\/admin\/kyc\/([^/]+)\/review$/);
      if (adminKycReviewMatch && event.httpMethod === 'POST') {
        const profileId = adminKycReviewMatch[1];
        const body = parseRequestBody(event.body);
        const validated = KycReviewSchema.parse(body);
        const updated = await KycService.reviewProfileAdmin(profileId, authUser.id, validated, clientIp, userAgent);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: updated }),
        };
      }
    }

    // =========================================================================
    // SUPPORT TICKET MODULE ROUTES (CLIENT & ADMIN)
    // =========================================================================
    if (path.startsWith('/support/tickets')) {
      if (!authUser) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Authentication required' }),
        };
      }

      // GET /api/support/tickets (List client's tickets)
      if (path === '/support/tickets' && event.httpMethod === 'GET') {
        const status = event.queryStringParameters?.status as string | undefined;
        const page = parseInt((event.queryStringParameters?.page as string) || '1', 10);
        const limit = parseInt((event.queryStringParameters?.limit as string) || '20', 10);
        const result = await SupportService.listClientTickets(authUser.id, status, page, limit);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result }),
        };
      }

      // POST /api/support/tickets (Create a new support ticket)
      if (path === '/support/tickets' && event.httpMethod === 'POST') {
        const body = parseRequestBody(event.body);
        const validated = CreateSupportTicketSchema.parse(body);
        const ticket = await SupportService.createTicket(authUser.id, validated, clientIp, userAgent);
        return {
          statusCode: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: ticket }),
        };
      }

      // GET /api/support/tickets/:id (View ticket detail - Strict IDOR)
      const ticketDetailMatch = path.match(/^\/support\/tickets\/([^/]+)$/);
      if (ticketDetailMatch && event.httpMethod === 'GET') {
        const ticketId = ticketDetailMatch[1];
        const detail = await SupportService.getTicketDetails(ticketId, authUser.id, false);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: detail }),
        };
      }

      // POST /api/support/tickets/:id/reply (Client reply)
      const ticketReplyMatch = path.match(/^\/support\/tickets\/([^/]+)\/reply$/);
      if (ticketReplyMatch && event.httpMethod === 'POST') {
        const ticketId = ticketReplyMatch[1];
        const body = parseRequestBody(event.body);
        const validated = ReplySupportTicketSchema.parse(body);
        const msg = await SupportService.replyToTicketClient(ticketId, authUser.id, validated, clientIp, userAgent);
        return {
          statusCode: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: msg }),
        };
      }

      // POST /api/support/tickets/:id/status (Client closes ticket)
      const ticketStatusMatch = path.match(/^\/support\/tickets\/([^/]+)\/status$/);
      if (ticketStatusMatch && event.httpMethod === 'POST') {
        const ticketId = ticketStatusMatch[1];
        const body = parseRequestBody(event.body);
        const validated = UpdateTicketStatusSchema.parse(body);
        const updated = await SupportService.updateTicketStatus(ticketId, authUser.id, false, validated, clientIp, userAgent);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: updated }),
        };
      }
    }

    // Admin Support Routes
    if (path.startsWith('/admin/support')) {
      if (!authUser) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Authentication required' }),
        };
      }
      if (authUser.role !== 'admin') {
        return {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error', message: 'Forbidden. Admin credentials required.' }),
        };
      }

      // GET /api/admin/support/tickets (List all tickets)
      if (path === '/admin/support/tickets' && event.httpMethod === 'GET') {
        const filters = {
          status: event.queryStringParameters?.status,
          category: event.queryStringParameters?.category,
          priority: event.queryStringParameters?.priority,
          search: event.queryStringParameters?.search,
        };
        const page = parseInt((event.queryStringParameters?.page as string) || '1', 10);
        const limit = parseInt((event.queryStringParameters?.limit as string) || '20', 10);
        const result = await SupportService.listAllTicketsAdmin(filters, page, limit);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: result }),
        };
      }

      // GET /api/admin/support/tickets/:id (Ticket detail with internal notes)
      const adminTicketDetailMatch = path.match(/^\/admin\/support\/tickets\/([^/]+)$/);
      if (adminTicketDetailMatch && event.httpMethod === 'GET') {
        const ticketId = adminTicketDetailMatch[1];
        const detail = await SupportService.getTicketDetails(ticketId, authUser.id, true);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: detail }),
        };
      }

      // POST /api/admin/support/tickets/:id/reply (Admin reply or internal note)
      const adminTicketReplyMatch = path.match(/^\/admin\/support\/tickets\/([^/]+)\/reply$/);
      if (adminTicketReplyMatch && event.httpMethod === 'POST') {
        const ticketId = adminTicketReplyMatch[1];
        const body = parseRequestBody(event.body);
        const validated = ReplySupportTicketSchema.parse(body);
        const msg = await SupportService.replyToTicketAdmin(ticketId, authUser.id, validated, clientIp, userAgent);
        return {
          statusCode: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: msg }),
        };
      }

      // POST /api/admin/support/tickets/:id/status (Admin change status)
      const adminTicketStatusMatch = path.match(/^\/admin\/support\/tickets\/([^/]+)\/status$/);
      if (adminTicketStatusMatch && event.httpMethod === 'POST') {
        const ticketId = adminTicketStatusMatch[1];
        const body = parseRequestBody(event.body);
        const validated = UpdateTicketStatusSchema.parse(body);
        const updated = await SupportService.updateTicketStatus(ticketId, authUser.id, true, validated, clientIp, userAgent);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'success', data: updated }),
        };
      }
    }

    return {
      statusCode: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', message: `Route not found: ${path}` }),
    };
  } catch (error: any) {
    if (
      error instanceof DatabaseConfigurationError ||
      error instanceof DatabaseConnectionError ||
      error.name === 'DatabaseConfigurationError' ||
      error.name === 'DatabaseConnectionError'
    ) {
      return {
        statusCode: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'error',
          code: 'DATABASE_SERVICE_UNAVAILABLE',
          message: error.message,
        }),
      };
    }

    if (error instanceof DatabaseSecurityError || error.name === 'DatabaseSecurityError') {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'error',
          code: 'DATABASE_SECURITY_ERROR',
          message: error.message,
        }),
      };
    }

    if (error instanceof JwtConfigurationError || error.name === 'JwtConfigurationError') {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'error',
          code: 'JWT_CONFIGURATION_ERROR',
          message: error.message,
        }),
      };
    }

    if (error instanceof ZodError) {
      return {
        statusCode: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'validation_error',
          errors: error.issues ? error.issues.map((e: any) => ({ field: e.path.join('.'), message: e.message })) : [],
        }),
      };
    }

    if (error.statusCode) {
      return {
        statusCode: error.statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'error', message: error.message || 'An error occurred' }),
      };
    }

    const message = error.message || 'An error occurred';
    let statusCode = 400;
    const lower = message.toLowerCase();
    if (
      lower.includes('unauthorized') ||
      lower.includes('forbidden') ||
      lower.includes('permission') ||
      lower.includes('access is denied') ||
      lower.includes('setup is permanently closed') ||
      lower.includes('setup secret') ||
      lower.includes('initial admin setup is disabled')
    ) {
      statusCode = 403;
    } else if (lower.includes('not found')) {
      statusCode = 404;
    }

    return {
      statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', message }),
    };
  }
};
