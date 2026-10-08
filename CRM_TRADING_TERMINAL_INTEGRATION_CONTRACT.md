# CRM -> Trading Terminal (Wave Trader) Integration Contract

**Document Version:** 1.0.0  
**Project Scope:** Forex CRM (Client Launch Interface)  
**Status:** Reconstructed from Live CRM Codebase & Production Audit  

---

## 1. Executive Summary & Integration Architecture

The Forex CRM integrates with the external **Wave Trader (Trading Terminal)** via a decoupled Client Panel launch interface. The Trading Terminal is hosted as an independent web application on Vercel (`https://trading-platform-two-mu.vercel.app`) with its dedicated backend on Render.

The CRM supports two primary launch presentation modes:
1. **Embedded Iframe View (`ClientWebTraderView.tsx`)**: The terminal is rendered inside an iframe in the client dashboard with real-time postMessage messaging for bidirectional actions (such as deposit navigation).
2. **Direct Browser Popout (`handlePopOut` / New Tab)**: The terminal is opened in a new browser tab with contextual query parameters and an authenticated launch token.

---

## 2. Launch Sequence & Execution Lifecycle

```
[Client User]
    │
    ▼
1. Navigates to 'WebTrader Terminal' (clientNav = 'trade') in Client Dashboard
    │
    ▼
2. GET /api/trading-accounts (Fetches user's active trading accounts)
    │
    ▼
3. POST /api/trading-accounts/:id/sso-token (or /api/trading-accounts/sso-token)
    ├── Headers: Authorization: Bearer <CRM_JWT>
    └── Backend validates account ownership (IDOR guard) & status ('active' | 'read_only')
    │
    ▼
4. CRM Backend generates short-lived JWT Launch Token (5-minute TTL)
    ├── Signed with: process.env.CRM_LAUNCH_SECRET
    └── Algorithm: HS256
    │
    ▼
5. CRM Frontend constructs target Terminal URL with URL query parameters
    └── https://trading-platform-two-mu.vercel.app?token=<JWT>&account=<ACC_NUM>&...
    │
    ▼
6. Frontend mounts iframe with sandbox & emits postMessage ('CRM_HANDSHAKE') upon iframe load
```

---

## 3. Data Contract: URL Query Parameters

When launching the Trading Terminal, the CRM builds a URL targeting the base terminal URL (`process.env.VITE_TRADING_PLATFORM_URL` or account-specific `terminal_url`, defaulting to `https://trading-platform-two-mu.vercel.app`):

| Parameter | Type | Required | Description | Example (Redacted) | Code Location | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `token` | String (JWT) | Yes | HS256 JWT signed with `CRM_LAUNCH_SECRET` (5m TTL) | `eyJhbGciOi...` | `ClientWebTraderView.tsx:145` | **PROVEN** |
| `account` | String | Yes | Account number / identifier | `57775` | `ClientWebTraderView.tsx:148` | **PROVEN** |
| `account_number` | String | Yes | Account number (duplicate alias for compatibility) | `57775` | `ClientWebTraderView.tsx:149` | **PROVEN** |
| `currency` | String | No | Account base currency | `USD` | `ClientWebTraderView.tsx:152` | **PROVEN** |
| `server` | String | No | Broker execution server name | `ForexCore-Live` | `ClientWebTraderView.tsx:155` | **PROVEN** |
| `platform` | String | No | Trading platform code (`MT4`, `MT5`, `WebTrader`, `cTrader`) | `MT5` | `ClientWebTraderView.tsx:158` | **PROVEN** |
| `user_id` | String | No | CRM User UUID | `3a1f8c...` | `ClientWebTraderView.tsx:161` | **PROVEN** |
| `email` | String | No | Client email address | `trader@example.com` | `ClientWebTraderView.tsx:164` | **PROVEN** |
| `theme` | String | No | Terminal theme styling | `dark` | `ClientWebTraderView.tsx:166` | **PROVEN** |
| `embedded` | String | Yes (Iframe) | Flag indicating embedded iframe context | `true` | `ClientWebTraderView.tsx:167` | **PROVEN** |
| `origin` | String | Yes (Iframe) | CRM window origin for return postMessage routing | `https://crm.example.com` | `ClientWebTraderView.tsx:168` | **PROVEN** |

---

## 4. Launch Token (JWT) Claims Schema

The SSO launch token issued by `POST /api/trading-accounts/:id/sso-token` contains the following cryptographic payload:

```json
{
  "iss": "crm-backend",
  "sub": "<user_uuid>",
  "aud": "trading-terminal",
  "accountId": "<trading_account_uuid>",
  "accountNumber": "<trading_account_number>",
  "tenantId": "default",
  "platform": "MT5",
  "currency": "USD",
  "accountType": "standard",
  "leverage": 500,
  "balance": 25000.00,
  "initialBalance": 25000.00,
  "clientId": "<user_uuid>",
  "userId": "<user_uuid>",
  "serverName": "ForexCore-Live",
  "email": "trader@example.com",
  "type": "trading_session",
  "iat": 1728189600,
  "exp": 1728189900
}
```

### Cryptographic Boundary:
- **Signing Algorithm:** HMAC-SHA256 (`HS256`)
- **Signing Key:** `CRM_LAUNCH_SECRET` (Strictly separated from CRM `JWT_SECRET`)
- **Expiration:** 300 seconds (5 minutes)
- **Status:** **PROVEN** via `netlify/functions/middleware/auth.ts:176` and `test-trading-sso-integration.ts`

---

## 5. Bidirectional `postMessage` Communication Protocol

When embedded in an `<iframe>`, the CRM and the Trading Terminal interact over window messaging:

### A. Messages Emitted by CRM:
1. **`CRM_HANDSHAKE`** (Sent immediately on iframe `onLoad`):
   ```json
   {
     "type": "CRM_HANDSHAKE",
     "token": "<JWT_LAUNCH_TOKEN>",
     "account": { ... },
     "user": { "id": "...", "email": "...", "name": "..." }
   }
   ```
2. **`CRM_HANDSHAKE_RESPONSE`** (Sent in reply to `GET_SESSION` or `REQUEST_HANDSHAKE`):
   ```json
   {
     "type": "CRM_HANDSHAKE_RESPONSE",
     "token": "<JWT_LAUNCH_TOKEN>",
     "account": { ... },
     "user": { "id": "...", "email": "...", "name": "..." }
   }
   ```

### B. Messages Handled by CRM (Inbound from Trading Terminal):
- `CRM_DEPOSIT`, `OPEN_DEPOSIT`, `TRADING_DEPOSIT` $\rightarrow$ Navigates CRM to Wallet Deposit view (`onNavigate('wallet')`).
- `CRM_ACCOUNTS`, `OPEN_ACCOUNTS` $\rightarrow$ Navigates CRM to Accounts view (`onNavigate('accounts')`).
- `CRM_SUPPORT`, `OPEN_SUPPORT` $\rightarrow$ Navigates CRM to Support Ticket view (`onNavigate('support')`).
- `GET_SESSION`, `REQUEST_HANDSHAKE` $\rightarrow$ Triggers CRM to respond with `CRM_HANDSHAKE_RESPONSE`.

---

## 6. Endpoints Involved in Launch Flow

1. **`GET /api/trading-accounts`**
   - **Auth:** Client Bearer Token (`JWT_SECRET`)
   - **Returns:** List of client trading accounts with server name, balance, platform, and optional `terminal_url`.
2. **`POST /api/trading-accounts/:id/sso-token`** (or `GET /api/trading-accounts/sso-token`)
   - **Auth:** Client Bearer Token (`JWT_SECRET`)
   - **Guards:** Verified account ownership + active status (`status === 'active' || status === 'read_only'`).
   - **Returns:** `{ status: 'success', data: { token: '...', account: { ... }, terminal_url: '...' } }`.
