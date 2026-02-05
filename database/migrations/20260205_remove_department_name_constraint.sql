-- Migration: 2026-02-05 - Remove restrictive department name constraint
-- Allows flexible department creation for all tenants

BEGIN;

-- Remove the restrictive CHECK constraint that only allows specific department names
ALTER TABLE departments
DROP CONSTRAINT IF EXISTS check_allowed_department_names;

COMMIT;