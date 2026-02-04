-- Points Allocation System - SQL Testing Guide
-- Use these queries to verify the implementation and debug issues

-- =====================================================
-- 1. SCHEMA VERIFICATION
-- =====================================================

-- Check new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('tenants', 'allocation_logs', 'platform_billing_logs', 'distribution_logs')
ORDER BY table_name, ordinal_position;

-- Verify CHECK constraints
SELECT constraint_name, constraint_definition
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%positive%' OR constraint_name LIKE '%allocation%';

-- =====================================================
-- 2. SAMPLE DATA SETUP
-- =====================================================

-- Create a test tenant (if not exists)
INSERT INTO tenants (id, name, slug, domain, status, subscription_tier, master_budget_balance, points_allocation_balance)
VALUES (
    '550e8400-e29b-41d4-a716-446655440099'::uuid,
    'Test Company',
    'test-company',
    'test.sparknode.com',
    'active',
    'professional',
    0,
    0
)
ON CONFLICT DO NOTHING;

-- Get test tenant ID
SELECT id, name, points_allocation_balance 
FROM tenants 
WHERE name = 'Test Company';

-- =====================================================
-- 3. ALLOCATION FLOW TESTING
-- =====================================================

-- 3.1 Platform Admin Allocates Points
-- (Simulating: PointsService.allocateToTenant())
BEGIN;

-- Get tenant
SELECT id, points_allocation_balance INTO tenant_var 
FROM tenants 
WHERE id = '550e8400-e29b-41d4-a716-446655440099'::uuid;

-- Allocate 50,000 points
UPDATE tenants 
SET points_allocation_balance = points_allocation_balance + 50000
WHERE id = '550e8400-e29b-41d4-a716-446655440099'::uuid;

-- Log the allocation
INSERT INTO allocation_logs (
    tenant_id, 
    admin_id, 
    amount, 
    currency, 
    transaction_type, 
    reference_note,
    previous_balance,
    new_balance
)
SELECT 
    '550e8400-e29b-41d4-a716-446655440099'::uuid,
    (SELECT id FROM users WHERE is_super_admin = true LIMIT 1),
    50000,
    'INR',
    'CREDIT_INJECTION',
    'Test allocation',
    0,
    50000;

COMMIT;

-- Verify allocation
SELECT id, name, points_allocation_balance 
FROM tenants 
WHERE id = '550e8400-e29b-41d4-a716-446655440099'::uuid;

-- View allocation logs
SELECT * FROM allocation_logs 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid
ORDER BY created_at DESC;

-- =====================================================
-- 4. DISTRIBUTION FLOW TESTING
-- =====================================================

-- 4.1 Award Points to Employee
-- (Simulating: PointsService.awardToUser())
BEGIN;

-- Get tenant current balance
SELECT points_allocation_balance INTO tenant_balance
FROM tenants 
WHERE id = '550e8400-e29b-41d4-a716-446655440099'::uuid;

-- Award 1,000 points to an employee
UPDATE tenants 
SET points_allocation_balance = points_allocation_balance - 1000
WHERE id = '550e8400-e29b-41d4-a716-446655440099'::uuid;

-- Award points to employee wallet
UPDATE wallets 
SET balance = balance + 1000,
    lifetime_earned = lifetime_earned + 1000,
    updated_at = NOW()
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid
  AND user_id = '<employee_id>'::uuid;

-- Create wallet ledger entry
INSERT INTO wallet_ledger (
    tenant_id, 
    wallet_id, 
    transaction_type, 
    source, 
    points, 
    balance_after,
    description,
    created_by
)
SELECT 
    '550e8400-e29b-41d4-a716-446655440099'::uuid,
    id,
    'credit',
    'recognition',
    1000,
    balance,
    'Test recognition award',
    '<manager_id>'::uuid
FROM wallets 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid
  AND user_id = '<employee_id>'::uuid;

-- Log distribution
INSERT INTO distribution_logs (
    tenant_id,
    from_user_id,
    to_user_id,
    amount,
    transaction_type,
    description,
    previous_pool_balance,
    new_pool_balance
)
VALUES (
    '550e8400-e29b-41d4-a716-446655440099'::uuid,
    '<manager_id>'::uuid,
    '<employee_id>'::uuid,
    1000,
    'RECOGNITION',
    'Test recognition',
    tenant_balance,
    tenant_balance - 1000
);

COMMIT;

-- =====================================================
-- 5. VERIFICATION QUERIES
-- =====================================================

-- 5.1 Tenant Pool Status
SELECT 
    name,
    points_allocation_balance as pool_balance,
    subscription_status
FROM tenants 
WHERE id = '550e8400-e29b-41d4-a716-446655440099'::uuid;

-- 5.2 Total Points Distributed
SELECT 
    SUM(amount) as total_distributed,
    COUNT(*) as transaction_count
FROM distribution_logs 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid;

-- 5.3 Employee Wallet Balance
SELECT 
    u.first_name,
    u.last_name,
    w.balance,
    w.lifetime_earned,
    w.lifetime_spent
FROM wallets w
JOIN users u ON w.user_id = u.id
WHERE w.tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid
ORDER BY w.balance DESC;

-- 5.4 Accounting Check (Points Ledger)
-- Points should always sum to original allocation
SELECT 
    'Tenant Pool Balance' as category,
    points_allocation_balance as points
FROM tenants 
WHERE id = '550e8400-e29b-41d4-a716-446655440099'::uuid

UNION ALL

SELECT 
    'Employee Wallets',
    COALESCE(SUM(balance), 0)
FROM wallets 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid

UNION ALL

SELECT 
    'Total Distributed (Historical)',
    COALESCE(SUM(amount), 0)
FROM distribution_logs 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid;

-- 5.5 Transaction History (Chronological)
SELECT 
    'allocation' as type,
    created_at,
    amount,
    transaction_type,
    reference_note as description
FROM allocation_logs 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid

UNION ALL

SELECT 
    'distribution',
    created_at,
    amount,
    transaction_type,
    description
FROM distribution_logs 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid

ORDER BY created_at DESC;

-- =====================================================
-- 6. ERROR CONDITION TESTING
-- =====================================================

-- 6.1 Test: Try to deduct more than available (should fail)
BEGIN;
UPDATE tenants 
SET points_allocation_balance = points_allocation_balance - 100000
WHERE id = '550e8400-e29b-41d4-a716-446655440099'::uuid;
-- This will fail with: "new row for relation "tenants" violates check constraint "positive_allocation_balance""
ROLLBACK;

-- 6.2 Test: Verify wallet negative balance is prevented
BEGIN;
UPDATE wallets 
SET balance = balance - 1000000
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid;
-- This will fail with: "new row for relation "wallets" violates check constraint "positive_balance""
ROLLBACK;

-- =====================================================
-- 7. AUDIT TRAIL VERIFICATION
-- =====================================================

-- 7.1 All actions for a tenant
SELECT 
    a.action,
    u.first_name,
    u.last_name,
    a.entity_type,
    a.new_values ->> 'amount_allocated' as points_allocated,
    a.created_at
FROM audit_log a
LEFT JOIN users u ON a.actor_id = u.id
WHERE a.tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid
  AND a.action IN ('points_allocated', 'recognition_created')
ORDER BY a.created_at DESC;

-- 7.2 Feed entries for visibility
SELECT 
    event_type,
    actor_id,
    target_id,
    visibility,
    event_metadata ->> 'amount' as amount,
    created_at
FROM feed 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid
ORDER BY created_at DESC;

-- =====================================================
-- 8. REPORTING QUERIES
-- =====================================================

-- 8.1 Monthly Allocation Report
SELECT 
    DATE_TRUNC('month', al.created_at)::date as month,
    COUNT(*) as allocation_count,
    SUM(al.amount) as total_allocated,
    SUM(CASE WHEN al.transaction_type = 'CREDIT_INJECTION' THEN al.amount ELSE -al.amount END) as net_allocated
FROM allocation_logs al
WHERE al.tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid
GROUP BY DATE_TRUNC('month', al.created_at)
ORDER BY month DESC;

-- 8.2 Distribution by Manager
SELECT 
    u.first_name || ' ' || u.last_name as manager_name,
    COUNT(*) as distribution_count,
    SUM(dl.amount) as total_points_distributed,
    AVG(dl.amount) as avg_award_size
FROM distribution_logs dl
JOIN users u ON dl.from_user_id = u.id
WHERE dl.tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid
GROUP BY u.id, u.first_name, u.last_name
ORDER BY total_points_distributed DESC;

-- 8.3 Recognition Awards Report
SELECT 
    DATE_TRUNC('day', r.created_at)::date as award_date,
    COUNT(*) as recognition_count,
    SUM(r.points) as total_points_awarded,
    AVG(r.points) as avg_points_per_recognition
FROM recognitions r
WHERE r.tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid
  AND r.points > 0
GROUP BY DATE_TRUNC('day', r.created_at)
ORDER BY award_date DESC;

-- =====================================================
-- 9. CLEANUP (Test Data)
-- =====================================================

-- Delete test data (careful!)
-- DELETE FROM allocation_logs WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid;
-- DELETE FROM distribution_logs WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440099'::uuid;
-- UPDATE tenants SET points_allocation_balance = 0 WHERE id = '550e8400-e29b-41d4-a716-446655440099'::uuid;
