-- Migration: 2026-02-09 - Standardize User Roles
-- Refactors legacy roles to the new 4-tier model:
-- platform_admin, tenant_manager, tenant_lead, tenant_user

BEGIN;

-- 1. Drop the old check constraint first to allow updates
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_role_check;

-- 2. Migrate existing user roles to standardized names
UPDATE users SET org_role = 'tenant_manager' WHERE org_role IN ('hr_admin');
UPDATE users SET org_role = 'tenant_lead' WHERE org_role IN ('dept_lead', 'manager', 'tenant_lead');
UPDATE users SET org_role = 'tenant_user' WHERE org_role IN ('corporate_user', 'employee', 'user', 'tenant_user');

-- 3. Add the new standardized check constraint
ALTER TABLE users ADD CONSTRAINT users_org_role_check CHECK (
    org_role IN ('platform_admin', 'tenant_manager', 'tenant_lead', 'tenant_user')
);

-- 4. Update any role-related strings in user_upload_staging if applicable
UPDATE user_upload_staging SET org_role = 'tenant_manager' WHERE org_role IN ('hr_admin');
UPDATE user_upload_staging SET org_role = 'tenant_lead' WHERE org_role IN ('dept_lead', 'manager', 'tenant_lead');
UPDATE user_upload_staging SET org_role = 'tenant_user' WHERE org_role IN ('corporate_user', 'employee', 'user', 'tenant_user');

UPDATE user_upload_staging SET raw_role = 'tenant_manager' WHERE raw_role IN ('hr_admin');
UPDATE user_upload_staging SET raw_role = 'tenant_lead' WHERE raw_role IN ('dept_lead', 'manager', 'tenant_lead');
UPDATE user_upload_staging SET raw_role = 'tenant_user' WHERE raw_role IN ('corporate_user', 'employee', 'user', 'tenant_user');

COMMIT;
