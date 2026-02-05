-- Migration: 2026-02-05 - Add 'dept_lead' to users org_role check constraint
BEGIN;

-- Remove existing constraint (if any)
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_org_role_check;

-- Recreate the constraint to include 'dept_lead'
ALTER TABLE users
ADD CONSTRAINT users_org_role_check CHECK (org_role IN (
    'platform_admin',
    'tenant_manager',
    'hr_admin',
    'dept_lead',
    'manager',
    'corporate_user',
    'employee'
));

COMMIT;