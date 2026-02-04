-- 2026-02-04: Add tenant settings fields for branding, currency, rewards, and controls
-- Adds columns used by the new Tenant settings implementation and normalizes existing data.

BEGIN;

-- Add new columns with defaults
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS branding_config JSONB DEFAULT '{}'::jsonb;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'INR';

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS markup_percent NUMERIC(5,2) DEFAULT 0.0;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS enabled_rewards JSONB DEFAULT '[]'::jsonb;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS redemptions_paused BOOLEAN DEFAULT FALSE;

-- Ensure existing rows have sensible values
UPDATE tenants SET branding_config = COALESCE(branding_config, '{}'::jsonb);
UPDATE tenants SET currency = COALESCE(currency, 'INR') WHERE currency IS NULL;
UPDATE tenants SET markup_percent = COALESCE(markup_percent, 0.0) WHERE markup_percent IS NULL;
UPDATE tenants SET enabled_rewards = COALESCE(enabled_rewards, '[]'::jsonb) WHERE enabled_rewards IS NULL;
UPDATE tenants SET redemptions_paused = COALESCE(redemptions_paused, FALSE) WHERE redemptions_paused IS NULL;

-- Normalize expiry_policy to canonical lowercase 'never' where appropriate
UPDATE tenants
  SET expiry_policy = 'never'
  WHERE expiry_policy IS NOT NULL AND LOWER(expiry_policy) = 'never';

-- Update default for auth_method to better reflect current default in code
ALTER TABLE tenants ALTER COLUMN auth_method SET DEFAULT 'OTP_ONLY';

COMMIT;
