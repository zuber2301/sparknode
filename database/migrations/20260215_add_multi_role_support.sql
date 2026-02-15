-- Migration: 2026-02-15 - Add multi-role support to users
-- Adds fields for multiple roles and default role selection

BEGIN;

-- Add columns for multi-role support
ALTER TABLE users
ADD COLUMN IF NOT EXISTS roles VARCHAR(255),
ADD COLUMN IF NOT EXISTS default_role VARCHAR(50);

-- Populate roles from existing org_role for backward compatibility
-- This ensures existing users have their current role in the roles field
UPDATE users
SET roles = org_role
WHERE roles IS NULL OR roles = '';

-- Set default_role to org_role (highest available role for multi-role users)
UPDATE users
SET default_role = org_role
WHERE default_role IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.roles IS 'Comma-separated list of roles this user has (e.g., "tenant_user,dept_lead,tenant_manager")';
COMMENT ON COLUMN users.default_role IS 'The default/primary role when user has multiple roles';

COMMIT;
