-- ============================================================================
-- Migration: 003_step3_trading_operations_control.sql
-- Target: Trading Engine PostgreSQL Database
-- Purpose: Persistent Idempotency Store & Operations Audit Trail for Step 3
-- Safety: Non-destructive, idempotent, production-safe
-- ============================================================================

-- 1. Idempotency Records Table
CREATE TABLE IF NOT EXISTS public.trading_idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(255) NOT NULL,
    action VARCHAR(64) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    http_status INT NOT NULL,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Unique index ensuring single execution per (idempotency_key, action) scope
CREATE UNIQUE INDEX IF NOT EXISTS uq_trading_idempotency_key_action 
ON public.trading_idempotency_records (idempotency_key, action);

-- Index for expiration cleanup queries
CREATE INDEX IF NOT EXISTS idx_trading_idempotency_expires 
ON public.trading_idempotency_records (expires_at);

-- 2. Trading Operations Admin Audit Log Table
CREATE TABLE IF NOT EXISTS public.trading_admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_account_id VARCHAR(128),
    target_object_id VARCHAR(128),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    request_reference VARCHAR(128),
    previous_state JSONB,
    new_state JSONB,
    payload_metadata JSONB,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_code VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for administrative query filtering and compliance auditing
CREATE INDEX IF NOT EXISTS idx_trading_audit_account 
ON public.trading_admin_audit_logs (target_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trading_audit_action 
ON public.trading_admin_audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trading_audit_tenant 
ON public.trading_admin_audit_logs (tenant_id, created_at DESC);
