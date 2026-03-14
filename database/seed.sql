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
ON CONFLICT (tenant_id, corporate_email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_super_admin = EXCLUDED.is_super_admin;

-- Link Platform Admin to SystemAdmin table
INSERT INTO system_admins (user_id, access_level, mfa_enabled)
VALUES ('220e8400-e29b-41d4-a716-446655440000', 'PLATFORM_ADMIN', TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- Tenant Manager: tenant_manager@sparknode.io
INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name, org_role, department_id)
VALUES
('220e8400-e29b-41d4-a716-446655440001', '100e8400-e29b-41d4-a716-446655440000', 'tenant_manager@sparknode.io', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Tenant', 'Admin', 'tenant_manager', '110e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (tenant_id, corporate_email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash;

-- Dept Lead: dept_lead@sparknode.io
INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name, org_role, department_id)
VALUES
('220e8400-e29b-41d4-a716-446655440002', '100e8400-e29b-41d4-a716-446655440000', 'dept_lead@sparknode.io', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Tenant', 'Lead', 'dept_lead', '110e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (tenant_id, corporate_email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash;

-- Tenant User: user@sparknode.io
INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name, org_role, department_id)
VALUES
('220e8400-e29b-41d4-a716-446655440003', '100e8400-e29b-41d4-a716-446655440000', 'user@sparknode.io', '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u', 'Tenant', 'User', 'tenant_user', '110e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (tenant_id, corporate_email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash;

-- Wallets for the 4 seeded users only
INSERT INTO wallets (id, tenant_id, user_id, balance, lifetime_earned, lifetime_spent)
VALUES
(uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', '220e8400-e29b-41d4-a716-446655440000', 0, 0, 0),
(uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440000', '220e8400-e29b-41d4-a716-446655440001', 0, 0, 0),
(uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440000', '220e8400-e29b-41d4-a716-446655440002', 0, 0, 0),
(uuid_generate_v4(), '100e8400-e29b-41d4-a716-446655440000', '220e8400-e29b-41d4-a716-446655440003', 0, 0, 0)
ON CONFLICT (user_id) DO NOTHING;

-- Clean up: Remove FK references to non-@sparknode.io users before deleting them.
-- Step 1: nullify nullable FK columns
UPDATE users SET manager_id = NULL
    WHERE manager_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE budget_allocation_ledger SET actor_id = NULL
    WHERE actor_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE budgets SET created_by = NULL
    WHERE created_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE department_budget_allocations SET allocated_by = NULL
    WHERE allocated_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE employee_points_allocations SET allocated_by = NULL
    WHERE allocated_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE event_nominations SET created_by = NULL
    WHERE created_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE event_nominations SET reviewed_by = NULL
    WHERE reviewed_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE event_participants SET approved_by = NULL
    WHERE approved_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE event_participants SET checked_in_by = NULL
    WHERE checked_in_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE events SET created_by = NULL
    WHERE created_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE feed SET actor_id = NULL
    WHERE actor_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE feed SET target_id = NULL
    WHERE target_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE invitation_tokens SET used_by_user_id = NULL
    WHERE used_by_user_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE invoices SET created_by = NULL
    WHERE created_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE master_budget_ledger SET created_by = NULL
    WHERE created_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE reward_catalog_custom SET created_by = NULL
    WHERE created_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE reward_catalog_master SET created_by = NULL
    WHERE created_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE reward_catalog_tenant SET created_by = NULL
    WHERE created_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE sales_campaigns SET approved_by = NULL
    WHERE approved_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE sales_event_leads SET owner_user_id = NULL
    WHERE owner_user_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE sales_events SET marketing_owner_id = NULL
    WHERE marketing_owner_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE sales_events SET owner_user_id = NULL
    WHERE owner_user_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
UPDATE tenant_budget_allocations SET allocated_by = NULL
    WHERE allocated_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
-- Step 2: delete rows whose NOT-NULL FK column references a non-seed user
DELETE FROM budget_allocation_logs
    WHERE admin_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
DELETE FROM budget_distribution_logs
    WHERE from_user_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io')
       OR to_user_id   IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
DELETE FROM event_progress
    WHERE user_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
DELETE FROM event_teams
    WHERE leader_user_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
DELETE FROM lead_registrations
    WHERE sales_rep_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
DELETE FROM platform_billing_logs
    WHERE admin_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
DELETE FROM recognition_comments
    WHERE user_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
DELETE FROM recognition_reactions
    WHERE user_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
DELETE FROM recognitions
    WHERE from_user_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io')
       OR to_user_id   IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
DELETE FROM redemptions
    WHERE user_id IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
DELETE FROM sales_campaigns
    WHERE created_by IN (SELECT id FROM users WHERE corporate_email NOT LIKE '%@sparknode.io');
-- Step 3: delete the non-seed users (CASCADE handles wallets, notifications, etc.)
DELETE FROM users WHERE corporate_email NOT LIKE '%@sparknode.io';

-- Clean up: Delete all system_admins not linked to @sparknode.io users
DELETE FROM system_admins WHERE user_id NOT IN (SELECT id FROM users WHERE corporate_email LIKE '%@sparknode.io');
