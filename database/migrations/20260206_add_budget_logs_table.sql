-- Migration: Add budget_logs table for tracking budget allocations and recalls
-- Version: 20260206
-- Description: Creates budget_logs table to track all budget movements between tenants and departments

BEGIN;

-- Create budget_logs table for tracking budget allocations and recalls
CREATE TABLE IF NOT EXISTS budget_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_dept_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    to_dept_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    from_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    to_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('ALLOCATE', 'RECALL', 'TRANSFER')),
    description TEXT,
    performed_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_budget_logs_tenant ON budget_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_logs_from_dept ON budget_logs(from_dept_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_logs_to_dept ON budget_logs(to_dept_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_logs_performed_by ON budget_logs(performed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_logs_action_type ON budget_logs(action_type, created_at DESC);

-- Add comments
COMMENT ON TABLE budget_logs IS 'Audit log for all budget movements between tenants and departments';
COMMENT ON COLUMN budget_logs.from_dept_id IS 'Department losing budget (NULL for tenant master pool)';
COMMENT ON COLUMN budget_logs.to_dept_id IS 'Department gaining budget (NULL for tenant master pool)';
COMMENT ON COLUMN budget_logs.from_tenant_id IS 'Tenant losing budget (for inter-tenant transfers)';
COMMENT ON COLUMN budget_logs.to_tenant_id IS 'Tenant gaining budget (for inter-tenant transfers)';
COMMENT ON COLUMN budget_logs.action_type IS 'Type of budget action: ALLOCATE, RECALL, TRANSFER';

COMMIT;