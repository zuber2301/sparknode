-- Migration: Rename Points to Budget terminology
-- Version: 20260204_v2
-- Description: Renames all "points_allocation" references to "budget_allocation"
-- Adds budget_allocated field for platform admin to tenant allocation

BEGIN;

-- =====================================================
-- TENANT TABLE UPDATES
-- =====================================================

-- Rename points_allocation_balance to budget_allocation_balance
ALTER TABLE tenants 
RENAME COLUMN points_allocation_balance TO budget_allocation_balance;

-- Rename constraint
ALTER TABLE tenants 
RENAME CONSTRAINT positive_allocation_balance TO positive_budget_allocation;

-- Add budget_allocated column to track total budget allocated by platform admin
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS budget_allocated DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Add CHECK constraint for budget_allocated
ALTER TABLE tenants 
ADD CONSTRAINT positive_budget_allocated CHECK (budget_allocated >= 0);

-- =====================================================
-- RENAME ALLOCATION LOGS TO BUDGET ALLOCATION LOGS
-- =====================================================

-- Rename allocation_logs to budget_allocation_logs
ALTER TABLE IF EXISTS allocation_logs RENAME TO budget_allocation_logs;

-- Rename indexes
DROP INDEX IF EXISTS idx_allocation_logs_tenant;
DROP INDEX IF EXISTS idx_allocation_logs_admin;

CREATE INDEX IF NOT EXISTS idx_budget_allocation_logs_tenant ON budget_allocation_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_allocation_logs_admin ON budget_allocation_logs(admin_id, created_at DESC);

-- =====================================================
-- RENAME DISTRIBUTION LOGS TO BUDGET DISTRIBUTION LOGS
-- =====================================================

-- Rename distribution_logs to budget_distribution_logs
ALTER TABLE IF EXISTS distribution_logs RENAME TO budget_distribution_logs;

-- Rename indexes
DROP INDEX IF EXISTS idx_distribution_logs_tenant;
DROP INDEX IF EXISTS idx_distribution_logs_from_user;
DROP INDEX IF EXISTS idx_distribution_logs_to_user;

CREATE INDEX IF NOT EXISTS idx_budget_distribution_logs_tenant ON budget_distribution_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_distribution_logs_from_user ON budget_distribution_logs(from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_distribution_logs_to_user ON budget_distribution_logs(to_user_id, created_at DESC);

-- Update transaction_type enum comments for clarity
COMMENT ON TABLE budget_allocation_logs IS 'Tracks budget allocations from platform admin to tenants';
COMMENT ON TABLE budget_distribution_logs IS 'Tracks budget distributions from tenant managers to employees';
COMMENT ON COLUMN tenants.budget_allocated IS 'Total budget allocated by platform admin';
COMMENT ON COLUMN tenants.budget_allocation_balance IS 'Remaining budget available for distribution by managers';

COMMIT;
