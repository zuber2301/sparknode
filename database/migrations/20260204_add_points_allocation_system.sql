-- Migration: Add Points Allocation System
-- Version: 20260204
-- Description: Implements the platform admin to tenant manager points allocation system
-- with proper ledger tracking and safety constraints

BEGIN;

-- =====================================================
-- TENANT TABLE UPDATES
-- =====================================================

-- Add points_allocation_balance to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS points_allocation_balance DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Add CHECK constraint to ensure non-negative balance
ALTER TABLE tenants 
ADD CONSTRAINT positive_allocation_balance CHECK (points_allocation_balance >= 0);

-- =====================================================
-- NEW ALLOCATION TRACKING TABLES
-- =====================================================

-- Allocation Logs: Track when Platform Admin allocates points to Tenant
CREATE TABLE IF NOT EXISTS allocation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    reference_note TEXT,
    transaction_type VARCHAR(50) NOT NULL DEFAULT 'CREDIT_INJECTION' 
        CHECK (transaction_type IN ('CREDIT_INJECTION', 'CLAWBACK', 'ADJUSTMENT')),
    previous_balance DECIMAL(15, 2),
    new_balance DECIMAL(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocation_logs_tenant ON allocation_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_allocation_logs_admin ON allocation_logs(admin_id, created_at DESC);

-- Platform Billing Logs: Audit trail for all platform-level transactions
CREATE TABLE IF NOT EXISTS platform_billing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    reference_note TEXT,
    transaction_type VARCHAR(50) NOT NULL DEFAULT 'CREDIT_INJECTION'
        CHECK (transaction_type IN ('CREDIT_INJECTION', 'CLAWBACK', 'REVERSAL', 'REFUND', 'ADJUSTMENT')),
    invoice_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_billing_logs_tenant ON platform_billing_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_billing_logs_admin ON platform_billing_logs(admin_id, created_at DESC);

-- Distribution Logs: Track when Tenant Manager distributes points to employees
CREATE TABLE IF NOT EXISTS distribution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id),
    to_user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(15, 2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL DEFAULT 'RECOGNITION'
        CHECK (transaction_type IN ('RECOGNITION', 'MANUAL_AWARD', 'EVENT_BONUS')),
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    previous_pool_balance DECIMAL(15, 2),
    new_pool_balance DECIMAL(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distribution_logs_tenant ON distribution_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_distribution_logs_from_user ON distribution_logs(from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_distribution_logs_to_user ON distribution_logs(to_user_id, created_at DESC);

-- =====================================================
-- WALLET TABLE UPDATES (Ensure CHECK constraint exists)
-- =====================================================

-- Add CHECK constraint to wallets if it doesn't exist
ALTER TABLE wallets 
DROP CONSTRAINT IF EXISTS positive_balance;

ALTER TABLE wallets 
ADD CONSTRAINT positive_balance CHECK (balance >= 0);

COMMIT;
