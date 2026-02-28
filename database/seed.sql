-- =====================================================
-- SparkNode — Seed Data (data only, no DDL)
--
-- DDL patches that were previously here have been moved to:
--   backend/alembic/versions/0003_seed_ddl_extraction.py
--
-- This file is safe to re-run; all INSERTs use ON CONFLICT DO NOTHING.
-- =====================================================

-- Create the Root Tenant for Platform Admin isolation
INSERT INTO tenants (id, name, slug, status, subscription_tier, subscription_status) 
VALUES ('00000000-0000-0000-0000-000000000000', 'root_tenant_sparknode', 'admin', 'active', 'enterprise', 'active')
ON CONFLICT (id) DO NOTHING;

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

-- Platform Admin: super_user@sparknode.io (uses platform_admin org_role + system_admins table)
INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name, org_role, department_id, is_super_admin)
VALUES
('220e8400-e29b-41d4-a716-446655440000', '00000000-0000-0000-0000-000000000000', 'super_user@sparknode.io', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Platform', 'Admin', 'platform_admin', '010e8400-e29b-41d4-a716-446655440000', TRUE)
ON CONFLICT (tenant_id, corporate_email) DO NOTHING;

-- Link Platform Admin to SystemAdmin table
INSERT INTO system_admins (user_id, access_level, mfa_enabled)
VALUES ('220e8400-e29b-41d4-a716-446655440000', 'PLATFORM_ADMIN', TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- Tenant Manager: tenant_manager@sparknode.io
INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name, org_role, department_id)
VALUES
('220e8400-e29b-41d4-a716-446655440001', '100e8400-e29b-41d4-a716-446655440000', 'tenant_manager@sparknode.io', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Tenant', 'Admin', 'tenant_manager', '110e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (tenant_id, corporate_email) DO NOTHING;

-- Dept Lead: dept_lead@sparknode.io
INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name, org_role, department_id)
VALUES
('220e8400-e29b-41d4-a716-446655440002', '100e8400-e29b-41d4-a716-446655440000', 'dept_lead@sparknode.io', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Tenant', 'Lead', 'dept_lead', '110e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (tenant_id, corporate_email) DO NOTHING;

-- Tenant User: user@sparknode.io
INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name, org_role, department_id)
VALUES
('220e8400-e29b-41d4-a716-446655440003', '100e8400-e29b-41d4-a716-446655440000', 'user@sparknode.io', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Tenant', 'User', 'tenant_user', '110e8400-e29b-41d4-a716-446655440000')
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
