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

UPDATE users SET corporate_email = email WHERE corporate_email IS NULL;
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
('110e8400-e29b-41d4-a716-446655440000', '100e8400-e29b-41d4-a716-446655440000', 'Platform'),
('110e8400-e29b-41d4-a716-446655440010', '100e8400-e29b-41d4-a716-446655440010', 'General'),
('110e8400-e29b-41d4-a716-446655440011', '100e8400-e29b-41d4-a716-446655440011', 'General'),
('110e8400-e29b-41d4-a716-446655440012', '100e8400-e29b-41d4-a716-446655440012', 'General')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- System admins (password is 'jspark123')
-- Hash: $2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u
INSERT INTO system_admins (id, email, password_hash, is_super_admin, mfa_enabled)
VALUES
('220e8400-e29b-41d4-a716-446655440000', 'admin@sparknode.io', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- Root tenant users (password is 'jspark123' for all)
-- Hash: $2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u
INSERT INTO users (id, tenant_id, email, corporate_email, password_hash, first_name, last_name, role, department_id, is_super_admin)
VALUES
('120e8400-e29b-41d4-a716-446655440001', '100e8400-e29b-41d4-a716-446655440000', 'tenant_admin@jspark.com', 'tenant_admin@jspark.com', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Tenant', 'Admin', 'tenant_admin', '110e8400-e29b-41d4-a716-446655440000', FALSE),
('120e8400-e29b-41d4-a716-446655440002', '100e8400-e29b-41d4-a716-446655440000', 'tenant_lead@jspark.com', 'tenant_lead@jspark.com', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Tenant', 'Lead', 'tenant_lead', '110e8400-e29b-41d4-a716-446655440000', FALSE),
('120e8400-e29b-41d4-a716-446655440003', '100e8400-e29b-41d4-a716-446655440000', 'user@jspark.com', 'user@jspark.com', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Corporate', 'User', 'corporate_user', '110e8400-e29b-41d4-a716-446655440000', FALSE)
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Bulk users per tenant (40 users each)
INSERT INTO users (id, tenant_id, email, corporate_email, password_hash, first_name, last_name, role, department_id)
SELECT uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440010',
       'user' || gs || '@triton.com',
     'user' || gs || '@triton.com',
       '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u',
       'Triton', 'User' || gs,
       CASE WHEN gs = 1 THEN 'tenant_admin'
            WHEN gs IN (2,3) THEN 'tenant_lead'
            ELSE 'corporate_user' END,
       '110e8400-e29b-41d4-a716-446655440010'
FROM generate_series(1, 40) AS gs
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO users (id, tenant_id, email, corporate_email, password_hash, first_name, last_name, role, department_id)
SELECT uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440011',
       'user' || gs || '@uniplane.com',
     'user' || gs || '@uniplane.com',
       '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u',
       'Uniplane', 'User' || gs,
       CASE WHEN gs = 1 THEN 'tenant_admin'
            WHEN gs IN (2,3) THEN 'tenant_lead'
            ELSE 'corporate_user' END,
       '110e8400-e29b-41d4-a716-446655440011'
FROM generate_series(1, 40) AS gs
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO users (id, tenant_id, email, corporate_email, password_hash, first_name, last_name, role, department_id)
SELECT uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440012',
       'user' || gs || '@zebra.com',
     'user' || gs || '@zebra.com',
       '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u',
       'Zebra', 'User' || gs,
       CASE WHEN gs = 1 THEN 'tenant_admin'
            WHEN gs IN (2,3) THEN 'tenant_lead'
            ELSE 'corporate_user' END,
       '110e8400-e29b-41d4-a716-446655440012'
FROM generate_series(1, 40) AS gs
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO users (id, tenant_id, email, corporate_email, password_hash, first_name, last_name, role, department_id)
SELECT uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440000',
       'jspark.user' || gs || '@jspark.com',
     'jspark.user' || gs || '@jspark.com',
       '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u',
       'jSpark', 'User' || gs,
       CASE WHEN gs = 1 THEN 'tenant_admin'
            WHEN gs IN (2,3) THEN 'tenant_lead'
            ELSE 'corporate_user' END,
       '110e8400-e29b-41d4-a716-446655440000'
FROM generate_series(1, 36) AS gs
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Wallets for seeded users
INSERT INTO wallets (tenant_id, user_id, balance, lifetime_earned, lifetime_spent)
SELECT u.tenant_id, u.id, 0, 0, 0
FROM users u
LEFT JOIN wallets w ON w.user_id = u.id
WHERE u.tenant_id IN (
    '100e8400-e29b-41d4-a716-446655440000',
    '100e8400-e29b-41d4-a716-446655440010',
    '100e8400-e29b-41d4-a716-446655440011',
    '100e8400-e29b-41d4-a716-446655440012'
)
AND w.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
