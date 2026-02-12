-- Migration: Implement three-level budget workflow
-- Platform Admin -> Tenant Manager -> Department Lead -> Employees
-- Date: 2026-02-09

-- =====================================================
-- BUDGET WORKFLOW TABLES
-- =====================================================

-- Table to track budget allocated by platform admin to tenant
-- This becomes the "Total Allocated Budget" available to tenant managers
CREATE TABLE IF NOT EXISTS tenant_budget_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    total_allocated_budget DECIMAL(15, 2) NOT NULL,
    remaining_balance DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
    allocation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_tenant_budget_allocations_tenant ON tenant_budget_allocations(tenant_id);

-- Table for department budget allocations
-- Tenant Manager distributes budget from tenant_budget_allocations to departments
CREATE TABLE IF NOT EXISTS department_budget_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    tenant_budget_allocation_id UUID NOT NULL REFERENCES tenant_budget_allocations(id) ON DELETE CASCADE,
    allocated_budget DECIMAL(15, 2) NOT NULL DEFAULT 0,
    distributed_budget DECIMAL(15, 2) NOT NULL DEFAULT 0,  -- sum of points distributed to employees
    remaining_budget DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
    allocation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID REFERENCES users(id),  -- tenant_manager who allocated
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, department_id),
    CONSTRAINT valid_allocated_budget CHECK (allocated_budget >= 0),
    CONSTRAINT valid_distributed_budget CHECK (distributed_budget >= 0)
);

CREATE INDEX idx_dept_budget_allocations_tenant ON department_budget_allocations(tenant_id);
CREATE INDEX idx_dept_budget_allocations_department ON department_budget_allocations(department_id);

-- Table for employee points allocation
-- Department Lead distributes points to employees in their department
CREATE TABLE IF NOT EXISTS employee_points_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    department_budget_allocation_id UUID NOT NULL REFERENCES department_budget_allocations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    allocated_points DECIMAL(15, 2) NOT NULL DEFAULT 0,
    spent_points DECIMAL(15, 2) NOT NULL DEFAULT 0,
    remaining_points DECIMAL(15, 2) GENERATED ALWAYS AS (allocated_points - spent_points) STORED,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
    allocation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID REFERENCES users(id),  -- dept_lead who allocated
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(department_budget_allocation_id, employee_id),
    CONSTRAINT valid_allocated_points CHECK (allocated_points >= 0),
    CONSTRAINT valid_spent_points CHECK (spent_points >= 0)
);

CREATE INDEX idx_employee_points_allocations_tenant ON employee_points_allocations(tenant_id);
CREATE INDEX idx_employee_points_allocations_employee ON employee_points_allocations(employee_id);

-- =====================================================
-- LEDGER TABLE FOR BUDGET WORKFLOW AUDITING
-- =====================================================

-- Track all budget allocation transactions for audit trail
CREATE TABLE IF NOT EXISTS budget_allocation_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'tenant_allocation',           -- Platform admin allocates to tenant
        'dept_allocation',             -- Tenant manager allocates to department
        'employee_allocation',         -- Dept lead allocates to employee
        'allocation_reversal',         -- Cancel allocation
        'points_spend'                 -- Points spent from employee allocation
    )),
    source_entity_type VARCHAR(50) NOT NULL,  -- tenant/department/employee
    source_entity_id UUID NOT NULL,
    target_entity_type VARCHAR(50),  -- department/employee (if applicable)
    target_entity_id UUID,
    amount DECIMAL(15, 2) NOT NULL,
    balance_before DECIMAL(15, 2),
    balance_after DECIMAL(15, 2),
    description TEXT,
    actor_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_budget_allocation_ledger_tenant ON budget_allocation_ledger(tenant_id);
CREATE INDEX idx_budget_allocation_ledger_transaction ON budget_allocation_ledger(transaction_type);
CREATE INDEX idx_budget_allocation_ledger_created ON budget_allocation_ledger(created_at DESC);

-- =====================================================
-- UPDATE EXISTING TABLES
-- =====================================================

-- Add columns to tenants table if they don't exist
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS total_allocated_budget DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_allocated_budget DECIMAL(15, 2) DEFAULT 0;

-- Add column to departments table if it doesn't exist  
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS allocated_budget DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS distributed_budget DECIMAL(15, 2) DEFAULT 0;

-- Add column to wallets to track allocated vs earned points
ALTER TABLE wallets
ADD COLUMN IF NOT EXISTS allocated_points DECIMAL(15, 2) DEFAULT 0;
