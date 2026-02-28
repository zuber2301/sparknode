"""Consolidate all raw SQL migrations into Alembic chain.

Bridges the legacy database/migrations/*.sql system into Alembic so that
all future schema changes go through a single tool (alembic).

Every statement uses IF NOT EXISTS / IF EXISTS guards so this migration
is **idempotent** — safe to run on databases that already have the changes.

For existing production databases, run:
    alembic stamp 0002_consolidate_raw_sql

This will mark the migration as applied without executing the SQL.

Revision ID: 0002_consolidate_raw_sql
Revises: 0001_tenant_isolation
"""
from alembic import op

revision = "0002_consolidate_raw_sql"
down_revision = "0001_tenant_isolation"
branch_labels = None
depends_on = None


# ─── SQL from database/migrations/ (sorted, concatenated) ────────────────────
# All statements are idempotent (IF NOT EXISTS / IF EXISTS / ON CONFLICT).

_UPGRADE_SQL = r"""
-- =====================================================================
-- Source: 002_add_currency_fields.sql
-- =====================================================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS display_currency VARCHAR(10) DEFAULT 'INR';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS points_label VARCHAR(50) DEFAULT 'Points';

-- =====================================================================
-- Source: 04_actor_model.sql
-- =====================================================================
ALTER TABLE recognitions ADD COLUMN IF NOT EXISTS actor_type VARCHAR(20) DEFAULT 'user';
ALTER TABLE recognitions ADD COLUMN IF NOT EXISTS actor_id UUID;
ALTER TABLE feed ADD COLUMN IF NOT EXISTS actor_type VARCHAR(20) DEFAULT 'user';
ALTER TABLE feed ADD COLUMN IF NOT EXISTS actor_id UUID;

-- =====================================================================
-- Source: 05_rename_role_to_org_role.sql  (constraint already present)
-- =====================================================================

-- =====================================================================
-- Source: 06_add_hr_fields.sql
-- =====================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20);

-- =====================================================================
-- Source: 20260130_add_tenant_properties.sql
-- =====================================================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branding_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS display_currency VARCHAR(10) DEFAULT 'INR';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS points_label VARCHAR(50) DEFAULT 'Points';

-- =====================================================================
-- Source: 20260130_update_actor_fks.sql  (idempotent ALTER only)
-- =====================================================================

-- =====================================================================
-- Source: 20260130_update_department_constraints.sql
-- =====================================================================
ALTER TABLE departments DROP CONSTRAINT IF EXISTS check_allowed_department_names;

-- =====================================================================
-- Source: 20260131_add_events_hub.sql
-- =====================================================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL DEFAULT 'in_person',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    location VARCHAR(500),
    virtual_link VARCHAR(500),
    max_participants INTEGER,
    budget_per_person DECIMAL(10, 2),
    total_budget DECIMAL(15, 2),
    status VARCHAR(50) DEFAULT 'draft',
    created_by UUID NOT NULL REFERENCES users(id),
    cover_image_url VARCHAR(500),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_tenant_id ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

CREATE TABLE IF NOT EXISTS event_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    activity_type VARCHAR(50) DEFAULT 'general',
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    location VARCHAR(500),
    points_value DECIMAL(10, 2) DEFAULT 0,
    max_participants INTEGER,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_activities_event_id ON event_activities(event_id);

CREATE TABLE IF NOT EXISTS event_nominations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES event_activities(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nominated_user_id UUID NOT NULL REFERENCES users(id),
    nominated_by UUID NOT NULL REFERENCES users(id),
    team_id UUID,
    status VARCHAR(50) DEFAULT 'pending',
    points_awarded DECIMAL(10, 2) DEFAULT 0,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_nominations_event_id ON event_nominations(event_id);

CREATE TABLE IF NOT EXISTS event_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    captain_id UUID REFERENCES users(id),
    points_earned DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_teams_event_id ON event_teams(event_id);

CREATE TABLE IF NOT EXISTS event_team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    points_contributed DECIMAL(10, 2) DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_team_members_team_id ON event_team_members(team_id);

CREATE TABLE IF NOT EXISTS event_gift_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    gift_type VARCHAR(50) DEFAULT 'voucher',
    voucher_id UUID REFERENCES vouchers(id),
    total_quantity INTEGER NOT NULL DEFAULT 0,
    distributed_quantity INTEGER DEFAULT 0,
    points_per_gift DECIMAL(10, 2) DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_gift_batches_event_id ON event_gift_batches(event_id);

CREATE TABLE IF NOT EXISTS event_gift_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES event_gift_batches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(batch_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    total_budget DECIMAL(15, 2) NOT NULL DEFAULT 0,
    spent_budget DECIMAL(15, 2) DEFAULT 0,
    remaining_budget DECIMAL(15, 2) GENERATED ALWAYS AS (total_budget - spent_budget) STORED,
    funded_by UUID REFERENCES users(id),
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_budgets_event_id ON event_budgets(event_id);

CREATE TABLE IF NOT EXISTS event_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    total_participants INTEGER DEFAULT 0,
    active_participants INTEGER DEFAULT 0,
    total_points_distributed DECIMAL(15, 2) DEFAULT 0,
    total_gifts_distributed INTEGER DEFAULT 0,
    nominations_count INTEGER DEFAULT 0,
    teams_count INTEGER DEFAULT 0,
    check_ins INTEGER DEFAULT 0,
    no_shows INTEGER DEFAULT 0,
    activity_metrics JSONB DEFAULT '{}',
    gifts_eligible INTEGER DEFAULT 0,
    gifts_issued INTEGER DEFAULT 0,
    gifts_redeemed INTEGER DEFAULT 0,
    department_metrics JSONB DEFAULT '{}',
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_metrics_event_id ON event_metrics(event_id);
CREATE INDEX IF NOT EXISTS idx_event_metrics_tenant_id ON event_metrics(tenant_id);

-- =====================================================================
-- Source: 20260201_add_bulk_upload_columns.sql  (all IF NOT EXISTS)
-- =====================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='raw_full_name') THEN
        ALTER TABLE user_upload_staging ADD COLUMN raw_full_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='raw_email') THEN
        ALTER TABLE user_upload_staging ADD COLUMN raw_email VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='raw_department') THEN
        ALTER TABLE user_upload_staging ADD COLUMN raw_department VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='raw_role') THEN
        ALTER TABLE user_upload_staging ADD COLUMN raw_role VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='raw_mobile_phone') THEN
        ALTER TABLE user_upload_staging ADD COLUMN raw_mobile_phone VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='is_valid') THEN
        ALTER TABLE user_upload_staging ADD COLUMN is_valid BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='validation_errors') THEN
        ALTER TABLE user_upload_staging ADD COLUMN validation_errors JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- =====================================================================
-- Source: 20260201_fix_validation_errors_type.sql
-- =====================================================================
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='validation_errors' AND data_type != 'jsonb') THEN
        ALTER TABLE user_upload_staging DROP COLUMN validation_errors;
        ALTER TABLE user_upload_staging ADD COLUMN validation_errors JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- =====================================================================
-- Source: 20260201_make_fullname_email_nullable.sql
-- =====================================================================
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='full_name' AND is_nullable='NO') THEN
        ALTER TABLE user_upload_staging ALTER COLUMN full_name DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='email' AND is_nullable='NO') THEN
        ALTER TABLE user_upload_staging ALTER COLUMN email DROP NOT NULL;
    END IF;
END $$;

-- =====================================================================
-- Source: 20260201_make_staging_columns_nullable.sql  (all IF EXISTS guards)
-- =====================================================================
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='first_name' AND is_nullable='NO') THEN
        ALTER TABLE user_upload_staging ALTER COLUMN first_name DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='last_name' AND is_nullable='NO') THEN
        ALTER TABLE user_upload_staging ALTER COLUMN last_name DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='manager_email' AND is_nullable='NO') THEN
        ALTER TABLE user_upload_staging ALTER COLUMN manager_email DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='corporate_email' AND is_nullable='NO') THEN
        ALTER TABLE user_upload_staging ALTER COLUMN corporate_email DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='personal_email' AND is_nullable='NO') THEN
        ALTER TABLE user_upload_staging ALTER COLUMN personal_email DROP NOT NULL;
    END IF;
END $$;

-- =====================================================================
-- Source: 20260204_add_points_allocation_system.sql
-- =====================================================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS points_allocation_balance DECIMAL(15, 2) NOT NULL DEFAULT 0;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'positive_allocation_balance') THEN
        ALTER TABLE tenants ADD CONSTRAINT positive_allocation_balance CHECK (points_allocation_balance >= 0);
    END IF;
END $$;

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

ALTER TABLE wallets DROP CONSTRAINT IF EXISTS positive_balance;
ALTER TABLE wallets ADD CONSTRAINT positive_balance CHECK (balance >= 0);

-- =====================================================================
-- Source: 20260204_add_tenant_settings_fields.sql
-- =====================================================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branding_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'INR';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS markup_percent NUMERIC(5,2) DEFAULT 0.0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS enabled_rewards JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS redemptions_paused BOOLEAN DEFAULT FALSE;

-- =====================================================================
-- Source: 20260204_rename_points_to_budget.sql
-- =====================================================================
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='tenants' AND column_name='points_allocation_balance') THEN
        ALTER TABLE tenants RENAME COLUMN points_allocation_balance TO budget_allocation_balance;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'positive_allocation_balance') THEN
        ALTER TABLE tenants RENAME CONSTRAINT positive_allocation_balance TO positive_budget_allocation;
    END IF;
END $$;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS budget_allocated DECIMAL(15, 2) NOT NULL DEFAULT 0;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'positive_budget_allocated') THEN
        ALTER TABLE tenants ADD CONSTRAINT positive_budget_allocated CHECK (budget_allocated >= 0);
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'allocation_logs') THEN
        ALTER TABLE IF EXISTS allocation_logs RENAME TO budget_allocation_logs;
    END IF;
END $$;
DROP INDEX IF EXISTS idx_allocation_logs_tenant;
DROP INDEX IF EXISTS idx_allocation_logs_admin;
CREATE INDEX IF NOT EXISTS idx_budget_allocation_logs_tenant ON budget_allocation_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_allocation_logs_admin ON budget_allocation_logs(admin_id, created_at DESC);

DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'distribution_logs') THEN
        ALTER TABLE IF EXISTS distribution_logs RENAME TO budget_distribution_logs;
    END IF;
END $$;
DROP INDEX IF EXISTS idx_distribution_logs_tenant;
DROP INDEX IF EXISTS idx_distribution_logs_from_user;
DROP INDEX IF EXISTS idx_distribution_logs_to_user;
CREATE INDEX IF NOT EXISTS idx_budget_distribution_logs_tenant ON budget_distribution_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_distribution_logs_from_user ON budget_distribution_logs(from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_distribution_logs_to_user ON budget_distribution_logs(to_user_id, created_at DESC);

-- =====================================================================
-- Source: 20260205_add_dept_lead_to_org_role.sql + 20260209_standardize_roles.sql
-- =====================================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_role_check;
ALTER TABLE users ADD CONSTRAINT users_org_role_check CHECK (
    org_role IN ('platform_admin', 'tenant_manager', 'dept_lead', 'tenant_user')
);

-- =====================================================================
-- Source: 20260205_enable_departments_rls.sql
-- =====================================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_departments') THEN
        CREATE POLICY tenant_isolation_departments ON departments
            USING (
                tenant_id = current_setting('app.tenant_id')::uuid
                OR current_setting('app.is_platform_admin', 'false') = 'true'
            );
    END IF;
END $$;

-- =====================================================================
-- Source: 20260205_remove_department_name_constraint.sql
-- =====================================================================
ALTER TABLE departments DROP CONSTRAINT IF EXISTS check_allowed_department_names;

-- =====================================================================
-- Source: 20260206_add_budget_logs_table.sql
-- =====================================================================
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
CREATE INDEX IF NOT EXISTS idx_budget_logs_tenant ON budget_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_logs_from_dept ON budget_logs(from_dept_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_logs_to_dept ON budget_logs(to_dept_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_logs_performed_by ON budget_logs(performed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_logs_action_type ON budget_logs(action_type, created_at DESC);

-- =====================================================================
-- Source: 20260206_add_department_budget_balance.sql
-- =====================================================================
ALTER TABLE departments ADD COLUMN IF NOT EXISTS budget_balance DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- =====================================================================
-- Source: 20260206_create_app_role.sql
-- =====================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sparknode_app') THEN
        CREATE ROLE sparknode_app LOGIN PASSWORD 'change_me_in_production';
    END IF;
END $$;
GRANT CONNECT ON DATABASE sparknode TO sparknode_app;
GRANT USAGE ON SCHEMA public TO sparknode_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sparknode_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sparknode_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sparknode_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sparknode_app;

-- =====================================================================
-- Source: 20260209_implement_budget_workflow.sql
-- =====================================================================
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
CREATE INDEX IF NOT EXISTS idx_tenant_budget_allocations_tenant ON tenant_budget_allocations(tenant_id);

CREATE TABLE IF NOT EXISTS department_budget_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    tenant_budget_allocation_id UUID NOT NULL REFERENCES tenant_budget_allocations(id) ON DELETE CASCADE,
    allocated_budget DECIMAL(15, 2) NOT NULL DEFAULT 0,
    distributed_budget DECIMAL(15, 2) NOT NULL DEFAULT 0,
    remaining_budget DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
    allocation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, department_id),
    CONSTRAINT valid_allocated_budget CHECK (allocated_budget >= 0),
    CONSTRAINT valid_distributed_budget CHECK (distributed_budget >= 0)
);
CREATE INDEX IF NOT EXISTS idx_dept_budget_allocations_tenant ON department_budget_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dept_budget_allocations_department ON department_budget_allocations(department_id);

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
    allocated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(department_budget_allocation_id, employee_id),
    CONSTRAINT valid_allocated_points CHECK (allocated_points >= 0),
    CONSTRAINT valid_spent_points CHECK (spent_points >= 0)
);
CREATE INDEX IF NOT EXISTS idx_employee_points_allocations_tenant ON employee_points_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_points_allocations_employee ON employee_points_allocations(employee_id);

CREATE TABLE IF NOT EXISTS budget_allocation_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'tenant_allocation', 'dept_allocation', 'employee_allocation',
        'allocation_reversal', 'points_spend'
    )),
    source_entity_type VARCHAR(50) NOT NULL,
    source_entity_id UUID NOT NULL,
    target_entity_type VARCHAR(50),
    target_entity_id UUID,
    amount DECIMAL(15, 2) NOT NULL,
    balance_before DECIMAL(15, 2),
    balance_after DECIMAL(15, 2),
    description TEXT,
    actor_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_budget_allocation_ledger_tenant ON budget_allocation_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_budget_allocation_ledger_transaction ON budget_allocation_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_budget_allocation_ledger_created ON budget_allocation_ledger(created_at DESC);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS total_allocated_budget DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS remaining_allocated_budget DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS allocated_budget DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS distributed_budget DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS allocated_points DECIMAL(15, 2) DEFAULT 0;

-- =====================================================================
-- Source: 20260215_add_crm_connectors_and_webhooks.sql
-- =====================================================================
CREATE TABLE IF NOT EXISTS crm_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    connector_type TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_connectors_tenant ON crm_connectors(tenant_id);

CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    connector_id UUID REFERENCES crm_connectors(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB,
    response_status INTEGER,
    response_body TEXT,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant ON webhook_logs(tenant_id);

-- =====================================================================
-- Source: 20260215_add_multi_role_support.sql
-- =====================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_role VARCHAR(50);
UPDATE users SET roles = org_role WHERE roles IS NULL OR roles = '';
UPDATE users SET default_role = org_role WHERE default_role IS NULL;

-- =====================================================================
-- Source: 20260215_add_sales_events_module.sql
-- =====================================================================
CREATE TABLE IF NOT EXISTS sales_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE,
    location TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    owner_user_id UUID NOT NULL REFERENCES users(id),
    marketing_owner_id UUID REFERENCES users(id),
    target_registrations INTEGER,
    target_pipeline NUMERIC(18,2),
    target_revenue NUMERIC(18,2),
    registration_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_events_tenant_id ON sales_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_events_status ON sales_events(status);

CREATE TABLE IF NOT EXISTS sales_event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES sales_events(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name TEXT,
    company TEXT,
    role VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'registered',
    source_channel VARCHAR(50),
    utm_source VARCHAR(255),
    utm_campaign VARCHAR(255),
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checked_in_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_sales_event_registrations_event_id ON sales_event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_sales_event_registrations_email ON sales_event_registrations(email);

CREATE TABLE IF NOT EXISTS sales_event_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES sales_events(id) ON DELETE CASCADE,
    registration_id UUID REFERENCES sales_event_registrations(id),
    owner_user_id UUID REFERENCES users(id),
    lead_status VARCHAR(50) NOT NULL DEFAULT 'new',
    qualification_fit VARCHAR(50),
    qualification_timing VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_event_leads_event_id ON sales_event_leads(event_id);
CREATE INDEX IF NOT EXISTS idx_sales_event_leads_owner_user_id ON sales_event_leads(owner_user_id);

CREATE TABLE IF NOT EXISTS sales_event_metrics (
    event_id UUID PRIMARY KEY REFERENCES sales_events(id) ON DELETE CASCADE,
    registrations INT DEFAULT 0,
    attendees INT DEFAULT 0,
    meetings_booked INT DEFAULT 0,
    opportunities INT DEFAULT 0,
    pipeline_value NUMERIC(18,2) DEFAULT 0,
    revenue_closed NUMERIC(18,2) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
"""


def upgrade() -> None:
    op.execute(_UPGRADE_SQL)


def downgrade() -> None:
    # Downgrade is intentionally a no-op for this consolidation migration.
    # The individual raw SQL migrations were never designed with rollback.
    # To revert, restore from a database backup.
    pass
