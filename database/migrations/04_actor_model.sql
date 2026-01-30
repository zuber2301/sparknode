-- Migration: Add explicit actor model columns
-- Add actor_type to audit_log
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_type VARCHAR(20) DEFAULT 'user';

-- Add created_by_type to master_budget_ledger
ALTER TABLE master_budget_ledger ADD COLUMN IF NOT EXISTS created_by_type VARCHAR(20) DEFAULT 'user';

-- Optional: Update existing records to 'user' if they were null (though DEFAULT should handle new rows)
UPDATE audit_log SET actor_type = 'user' WHERE actor_type IS NULL;
UPDATE master_budget_ledger SET created_by_type = 'user' WHERE created_by_type IS NULL;
