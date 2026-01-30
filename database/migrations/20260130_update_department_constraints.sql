-- Migration: 2026-01-30 - Update Department Constraints
BEGIN;

-- First, ensure existing department names are valid (this might fail if existing data is invalid)
-- For this environment, we assume we can clean/standardize or that it's a fresh setup.
-- If there's an existing 'Human Resources', we might want to update it to 'Human Resource (HR)'
UPDATE departments SET name = 'Human Resource (HR)' WHERE name ILIKE 'Human Resource%';

-- Apply CHECK constraint and NOT NULL is already there but we ensure it
ALTER TABLE departments ALTER COLUMN name SET NOT NULL;

ALTER TABLE departments 
ADD CONSTRAINT check_allowed_department_names 
CHECK (name IN ('Human Resource (HR)', 'Techology (IT)', 'Sale & Marketting', 'Business Unit -1', 'Business Unit-2', 'Business Unit-3'));

COMMIT;
