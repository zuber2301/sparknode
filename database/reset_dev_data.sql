-- =====================================================
-- SparkNode — Dev/Demo Data Reset Utility
--
-- ⚠️  WARNING: DESTRUCTIVE — wipes ALL non-seed runtime
--     data (tenants, users, recognitions, etc.).
--
-- Use ONLY in development or demo environments to
-- restore a pristine seed-only state.
--
-- NEVER run this in production.
--
-- Usage (manual, explicit invocation only):
--   docker exec -i sparknode-db psql -U sparknode -d sparknode \
--     < database/reset_dev_data.sql
-- =====================================================

BEGIN;

-- Step 1: nullify nullable FK columns that reference non-seed users
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

-- Step 3: delete non-seed users (CASCADE handles wallets, notifications, etc.)
DELETE FROM users WHERE corporate_email NOT LIKE '%@sparknode.io';

-- Step 4: delete non-seed tenants (except seed UUIDs)
-- NOTE: '550e8400-e29b-41d4-a716-446655440000' (Demo Company) is intentionally
-- preserved here — it was created outside seed.sql but is treated as a baseline
-- demo tenant. API-provisioned tenants (t01, TestTenant3, etc.) ARE deleted so
-- that their manager accounts are always re-provisioned cleanly through the API.
DELETE FROM tenants WHERE id NOT IN (
    '00000000-0000-0000-0000-000000000000',
    '100e8400-e29b-41d4-a716-446655440000',
    '100e8400-e29b-41d4-a716-446655440001',
    '100e8400-e29b-41d4-a716-446655440010',
    '100e8400-e29b-41d4-a716-446655440011',
    '100e8400-e29b-41d4-a716-446655440012',
    '550e8400-e29b-41d4-a716-446655440000'   -- Demo Company (baseline demo tenant)
);

-- Step 5: clean up orphaned system_admins
DELETE FROM system_admins WHERE user_id NOT IN (
    SELECT id FROM users WHERE corporate_email LIKE '%@sparknode.io'
);

COMMIT;
