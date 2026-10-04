-- =============================================================================
-- Migration: 001_create_missing_production_tables.sql
-- Description: Idempotent migration to provision missing production tables:
--              1. system_settings (Broker configuration & dynamic branding)
--              2. account_transfers (Wallet <-> Trading Account internal transfers)
--              3. trading_password_resets (Client trading account password reset requests)
-- Safe for execution on live PostgreSQL databases (Neon, Supabase, RDS, Cloud SQL).
-- =============================================================================

-- Ensure pgcrypto extension is enabled for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Table: system_settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Table: account_transfers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    trading_account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    direction VARCHAR(30) NOT NULL CHECK (direction IN ('wallet_to_trading', 'trading_to_wallet')),
    amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    client_notes TEXT,
    admin_notes TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance & Query Indexes for account_transfers
CREATE INDEX IF NOT EXISTS idx_account_transfers_user_id ON account_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_wallet_id ON account_transfers(wallet_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_trading_account_id ON account_transfers(trading_account_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_status ON account_transfers(status);

-- -----------------------------------------------------------------------------
-- 3. Table: trading_password_resets
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trading_password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trading_account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT,
    admin_notes TEXT,
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance & Query Indexes for trading_password_resets
CREATE INDEX IF NOT EXISTS idx_trading_password_resets_user_id ON trading_password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_password_resets_account_id ON trading_password_resets(trading_account_id);
CREATE INDEX IF NOT EXISTS idx_trading_password_resets_status ON trading_password_resets(status);
