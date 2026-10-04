-- =============================================================================
-- Migration: 002_step2_wallet_funding_control.sql
-- Description: Provisions account_transfers table with Step-2 execution tracking,
--              idempotency, and ledger support for Wallet <-> Trading Account transfers.
-- Safe and idempotent for execution in Supabase / PostgreSQL SQL Editor.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create account_transfers table if it doesn't already exist
CREATE TABLE IF NOT EXISTS account_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    trading_account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    direction VARCHAR(30) NOT NULL CHECK (direction IN ('wallet_to_trading', 'trading_to_wallet')),
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'failed', 'cancelled')),
    execution_status VARCHAR(30) NOT NULL DEFAULT 'unexecuted' CHECK (execution_status IN ('unexecuted', 'executing', 'confirmed', 'failed')),
    external_transaction_id VARCHAR(100),
    executed_at TIMESTAMPTZ,
    idempotency_key VARCHAR(100),
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

-- 2. Add columns if table already existed without Step-2 columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_transfers' AND column_name = 'execution_status') THEN
        ALTER TABLE account_transfers ADD COLUMN execution_status VARCHAR(30) NOT NULL DEFAULT 'unexecuted';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_transfers' AND column_name = 'external_transaction_id') THEN
        ALTER TABLE account_transfers ADD COLUMN external_transaction_id VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_transfers' AND column_name = 'executed_at') THEN
        ALTER TABLE account_transfers ADD COLUMN executed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_transfers' AND column_name = 'idempotency_key') THEN
        ALTER TABLE account_transfers ADD COLUMN idempotency_key VARCHAR(100);
    END IF;
END $$;

-- 3. Update transactions table type check constraint to include transfer_reserve and transfer_release
DO $$
BEGIN
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
    ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (
        type IN (
            'deposit',
            'withdrawal',
            'withdrawal_reserve',
            'withdrawal_release',
            'adjustment_credit',
            'adjustment_debit',
            'transfer_in',
            'transfer_out',
            'transfer_reserve',
            'transfer_release'
        )
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 4. Update account_transfers status check constraints
DO $$
BEGIN
    ALTER TABLE account_transfers DROP CONSTRAINT IF EXISTS account_transfers_status_check;
    ALTER TABLE account_transfers ADD CONSTRAINT account_transfers_status_check CHECK (
        status IN ('pending', 'approved', 'rejected', 'completed', 'failed', 'cancelled')
    );
    ALTER TABLE account_transfers DROP CONSTRAINT IF EXISTS account_transfers_execution_status_check;
    ALTER TABLE account_transfers ADD CONSTRAINT account_transfers_execution_status_check CHECK (
        execution_status IN ('unexecuted', 'executing', 'confirmed', 'failed')
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 5. Performance & Idempotency Indexes
CREATE INDEX IF NOT EXISTS idx_account_transfers_user_id ON account_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_wallet_id ON account_transfers(wallet_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_trading_account_id ON account_transfers(trading_account_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_status ON account_transfers(status);
CREATE INDEX IF NOT EXISTS idx_account_transfers_execution_status ON account_transfers(execution_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_transfers_idempotency_key ON account_transfers(idempotency_key) WHERE idempotency_key IS NOT NULL;
