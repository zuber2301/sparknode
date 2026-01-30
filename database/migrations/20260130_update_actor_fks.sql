-- Migration: 2026-01-30
-- Drop foreign key constraints that enforce 'users' FK on actor fields
BEGIN;

ALTER TABLE IF EXISTS master_budget_ledger DROP CONSTRAINT IF EXISTS master_budget_ledger_created_by_fkey;
ALTER TABLE IF EXISTS audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;

-- Ensure actor columns exist and are nullable UUIDs
ALTER TABLE IF EXISTS master_budget_ledger ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE IF EXISTS audit_log ALTER COLUMN actor_id DROP NOT NULL;

COMMIT;
