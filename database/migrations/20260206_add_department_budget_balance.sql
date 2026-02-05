-- Migration: Add budget_balance field to departments table
-- This allows departments to have their own budget balance that can be topped up from tenant master pool

ALTER TABLE departments
ADD COLUMN budget_balance DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN departments.budget_balance IS 'Department budget balance available for department leads to allocate';

-- To apply:
-- PGPASSWORD=... psql -h <host> -p <port> -U <user> -d <db> -f 20260206_add_department_budget_balance.sql