-- Create the Root Tenant for Platform Admin isolation
INSERT INTO tenants (id, name, slug, status, subscription_tier, subscription_status) 
VALUES ('00000000-0000-0000-0000-000000000000', 'root_tenant_sparknode', 'admin', 'active', 'enterprise', 'active')
ON CONFLICT (id) DO NOTHING;

-- Schema patches (idempotent)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branding_config JSONB DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS master_budget_balance DECIMAL(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS corporate_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP WITH TIME ZONE;
DO $$
DECLARE
     constraint_record RECORD;
BEGIN
     FOR constraint_record IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = 'users'::regclass AND contype = 'c'
            AND pg_get_constraintdef(oid) ILIKE '%status%'
     LOOP
          EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_record.conname);
     END LOOP;
     EXECUTE 'ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN (''PENDING_INVITE'', ''ACTIVE'', ''DEACTIVATED'', ''pending_invite'', ''active'', ''deactivated''))';
END $$;

-- Drop old System Admins if it has email column (legacy)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_admins' AND column_name='email') THEN
        DROP TABLE system_admins CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS system_admins (
     admin_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
     access_level VARCHAR(20) DEFAULT 'PLATFORM_ADMIN',
     mfa_enabled BOOLEAN DEFAULT TRUE,
     last_login_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE system_admins ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS otp_tokens (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     channel VARCHAR(20) NOT NULL,
     destination VARCHAR(255) NOT NULL,
     token_hash VARCHAR(255) NOT NULL,
     expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
     used_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_upload_staging (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     batch_id UUID NOT NULL,
     full_name VARCHAR(255) NOT NULL,
     email VARCHAR(255) NOT NULL,
     department_name VARCHAR(255),
     role VARCHAR(50),
     manager_email VARCHAR(255),
     first_name VARCHAR(100),
     last_name VARCHAR(100),
     department_id UUID,
     manager_id UUID,
     status VARCHAR(50) DEFAULT 'pending',
     errors JSONB DEFAULT '[]'::jsonb,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_upload_staging_batch ON user_upload_staging(batch_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_corporate_email ON users(tenant_id, corporate_email);

-- Tenants
INSERT INTO tenants (id, name, slug, domain, status, subscription_tier, master_budget_balance)
VALUES
('100e8400-e29b-41d4-a716-446655440000', 'jSpark', 'jspark', 'jspark.sparknode.io', 'active', 'enterprise', 0),
('100e8400-e29b-41d4-a716-446655440001', 'All Tenants', 'all-tenants', NULL, 'active', 'enterprise', 0),
('100e8400-e29b-41d4-a716-446655440010', 'Triton', 'triton', 'triton.sparknode.io', 'active', 'professional', 0),
('100e8400-e29b-41d4-a716-446655440011', 'Uniplane', 'uniplane', 'uniplane.sparknode.io', 'active', 'starter', 0),
('100e8400-e29b-41d4-a716-446655440012', 'Zebra', 'zebra', 'zebra.sparknode.io', 'active', 'starter', 0)
ON CONFLICT (id) DO NOTHING;

-- Departments
INSERT INTO departments (id, tenant_id, name)
VALUES
('010e8400-e29b-41d4-a716-446655440000', '00000000-0000-0000-0000-000000000000', 'Human Resource (HR)'),
('110e8400-e29b-41d4-a716-446655440000', '100e8400-e29b-41d4-a716-446655440000', 'Human Resource (HR)'),
('110e8400-e29b-41d4-a716-446655441000', '100e8400-e29b-41d4-a716-446655440000', 'Techology (IT)'),
('110e8400-e29b-41d4-a716-446655442000', '100e8400-e29b-41d4-a716-446655440000', 'Sale & Marketting'),
('110e8400-e29b-41d4-a716-446655443000', '100e8400-e29b-41d4-a716-446655440000', 'Business Unit -1'),
('110e8400-e29b-41d4-a716-446655444000', '100e8400-e29b-41d4-a716-446655440000', 'Business Unit-2'),
('110e8400-e29b-41d4-a716-446655445000', '100e8400-e29b-41d4-a716-446655440000', 'Business Unit-3'),

('110e8400-e29b-41d4-a716-446655440010', '100e8400-e29b-41d4-a716-446655440010', 'Human Resource (HR)'),
('110e8400-e29b-41d4-a716-446655441010', '100e8400-e29b-41d4-a716-446655440010', 'Techology (IT)'),

('110e8400-e29b-41d4-a716-446655440011', '100e8400-e29b-41d4-a716-446655440011', 'Human Resource (HR)'),
('110e8400-e29b-41d4-a716-446655441011', '100e8400-e29b-41d4-a716-446655440011', 'Techology (IT)'),

('110e8400-e29b-41d4-a716-446655440012', '100e8400-e29b-41d4-a716-446655440012', 'Human Resource (HR)'),
('110e8400-e29b-41d4-a716-446655441012', '100e8400-e29b-41d4-a716-446655440012', 'Techology (IT)')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- =====================================================
-- BOOTSTRAP: Only 4 Seeded Accounts (all @sparknode.io)
-- Password: jspark123
-- Hash: $2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u
-- =====================================================

-- Platform Admin: super_user@sparknode.io (uses hr_admin org_role + system_admins table)
INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name, org_role, department_id, is_super_admin)
VALUES
('220e8400-e29b-41d4-a716-446655440000', '00000000-0000-0000-0000-000000000000', 'super_user@sparknode.io', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Platform', 'Admin', 'hr_admin', '010e8400-e29b-41d4-a716-446655440000', TRUE)
ON CONFLICT (tenant_id, corporate_email) DO NOTHING;

-- Link Platform Admin to SystemAdmin table
INSERT INTO system_admins (user_id, access_level, mfa_enabled)
VALUES ('220e8400-e29b-41d4-a716-446655440000', 'PLATFORM_ADMIN', TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- Tenant Admin: tenant_admin@sparknode.io
INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name, org_role, department_id)
VALUES
('220e8400-e29b-41d4-a716-446655440001', '100e8400-e29b-41d4-a716-446655440000', 'tenant_admin@sparknode.io', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Tenant', 'Admin', 'tenant_admin', '110e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (tenant_id, corporate_email) DO NOTHING;

-- Tenant Lead: tenant_lead@sparknode.io
INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name, org_role, department_id)
VALUES
('220e8400-e29b-41d4-a716-446655440002', '100e8400-e29b-41d4-a716-446655440000', 'tenant_lead@sparknode.io', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Tenant', 'Lead', 'tenant_lead', '110e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (tenant_id, corporate_email) DO NOTHING;

-- Tenant User (Corporate User): user@sparknode.io
INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name, org_role, department_id)
VALUES
('220e8400-e29b-41d4-a716-446655440003', '100e8400-e29b-41d4-a716-446655440000', 'user@sparknode.io', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Corporate', 'User', 'corporate_user', '110e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (tenant_id, corporate_email) DO NOTHING;

-- Wallets for the 4 seeded users only
INSERT INTO wallets (id, tenant_id, user_id, balance, lifetime_earned, lifetime_spent)
VALUES
(uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', '220e8400-e29b-41d4-a716-446655440000', 0, 0, 0),
(uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440000', '220e8400-e29b-41d4-a716-446655440001', 0, 0, 0),
(uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440000', '220e8400-e29b-41d4-a716-446655440002', 0, 0, 0),
(uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440000', '220e8400-e29b-41d4-a716-446655440003', 0, 0, 0)
ON CONFLICT (user_id) DO NOTHING;

-- Clean up: Delete all users NOT matching @sparknode.io domain
DELETE FROM users WHERE corporate_email NOT LIKE '%@sparknode.io';

-- Clean up: Delete all system_admins not linked to @sparknode.io users
DELETE FROM system_admins WHERE user_id NOT IN (SELECT id FROM users WHERE corporate_email LIKE '%@sparknode.io');
