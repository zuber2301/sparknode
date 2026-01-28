-- SparkNode seed data (idempotent)
-- Safe to re-run; uses ON CONFLICT DO NOTHING

-- Schema patches (idempotent)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branding_config JSONB DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS master_budget_balance DECIMAL(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Tenants
INSERT INTO tenants (id, name, slug, domain, status, subscription_tier, master_budget_balance)
VALUES
('100e8400-e29b-41d4-a716-446655440000', 'jSpark', 'jspark', 'jspark.nodewave.io', 'active', 'enterprise', 0),
('100e8400-e29b-41d4-a716-446655440001', 'All Tenants', 'all-tenants', NULL, 'active', 'enterprise', 0),
('100e8400-e29b-41d4-a716-446655440010', 'Triton', 'triton', 'triton.nodewave.io', 'active', 'professional', 0),
('100e8400-e29b-41d4-a716-446655440011', 'Uniplane', 'uniplane', 'uniplane.nodewave.io', 'active', 'starter', 0),
('100e8400-e29b-41d4-a716-446655440012', 'Zebra', 'zebra', 'zebra.nodewave.io', 'active', 'starter', 0)
ON CONFLICT (id) DO NOTHING;

-- Departments
INSERT INTO departments (id, tenant_id, name)
VALUES
('110e8400-e29b-41d4-a716-446655440000', '100e8400-e29b-41d4-a716-446655440000', 'Platform'),
('110e8400-e29b-41d4-a716-446655440010', '100e8400-e29b-41d4-a716-446655440010', 'General'),
('110e8400-e29b-41d4-a716-446655440011', '100e8400-e29b-41d4-a716-446655440011', 'General'),
('110e8400-e29b-41d4-a716-446655440012', '100e8400-e29b-41d4-a716-446655440012', 'General')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Root tenant users (password is 'jspark123' for all)
-- Hash: $2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, department_id, is_super_admin)
VALUES
('120e8400-e29b-41d4-a716-446655440000', '100e8400-e29b-41d4-a716-446655440000', 'super_user@jspark.com', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Super', 'User', 'platform_owner', '110e8400-e29b-41d4-a716-446655440000', TRUE),
('120e8400-e29b-41d4-a716-446655440001', '100e8400-e29b-41d4-a716-446655440000', 'tenant_admin@jspark.com', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Tenant', 'Admin', 'tenant_admin', '110e8400-e29b-41d4-a716-446655440000', FALSE),
('120e8400-e29b-41d4-a716-446655440002', '100e8400-e29b-41d4-a716-446655440000', 'tenant_lead@jspark.com', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Tenant', 'Lead', 'tenant_lead', '110e8400-e29b-41d4-a716-446655440000', FALSE),
('120e8400-e29b-41d4-a716-446655440003', '100e8400-e29b-41d4-a716-446655440000', 'user@jspark.com', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Corporate', 'User', 'corporate_user', '110e8400-e29b-41d4-a716-446655440000', FALSE)
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Bulk users per tenant (40 users each)
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, department_id)
SELECT uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440010',
       'user' || gs || '@triton.com',
       '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u',
       'Triton', 'User' || gs,
       CASE WHEN gs = 1 THEN 'tenant_admin'
            WHEN gs IN (2,3) THEN 'tenant_lead'
            ELSE 'corporate_user' END,
       '110e8400-e29b-41d4-a716-446655440010'
FROM generate_series(1, 40) AS gs
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, department_id)
SELECT uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440011',
       'user' || gs || '@uniplane.com',
       '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u',
       'Uniplane', 'User' || gs,
       CASE WHEN gs = 1 THEN 'tenant_admin'
            WHEN gs IN (2,3) THEN 'tenant_lead'
            ELSE 'corporate_user' END,
       '110e8400-e29b-41d4-a716-446655440011'
FROM generate_series(1, 40) AS gs
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, department_id)
SELECT uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440012',
       'user' || gs || '@zebra.com',
       '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u',
       'Zebra', 'User' || gs,
       CASE WHEN gs = 1 THEN 'tenant_admin'
            WHEN gs IN (2,3) THEN 'tenant_lead'
            ELSE 'corporate_user' END,
       '110e8400-e29b-41d4-a716-446655440012'
FROM generate_series(1, 40) AS gs
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, department_id)
SELECT uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440000',
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
