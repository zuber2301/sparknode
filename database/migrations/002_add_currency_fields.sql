-- Migration: Add multi-currency support to tenants table
-- Version: 002
-- Created: 2026-02-01
-- Description: Adds base_currency, display_currency, and fx_rate columns to support multi-currency tenant configuration

BEGIN TRANSACTION;

-- Add currency columns to tenants table
ALTER TABLE tenants
ADD COLUMN base_currency VARCHAR(3) DEFAULT 'USD' CHECK (base_currency IN ('USD', 'INR', 'EUR', 'GBP', 'JPY')),
ADD COLUMN display_currency VARCHAR(3) DEFAULT 'USD' CHECK (display_currency IN ('USD', 'INR', 'EUR', 'GBP', 'JPY')),
ADD COLUMN fx_rate NUMERIC(10, 4) DEFAULT 1.0 CHECK (fx_rate > 0);

-- Add index for currency lookups
CREATE INDEX idx_tenants_display_currency ON tenants(display_currency);

-- Add comment explaining the fx_rate column
COMMENT ON COLUMN tenants.fx_rate IS 'Exchange rate: 1 base_currency = fx_rate * display_currency. E.g., 1 USD = 83.12 INR';

COMMIT;
