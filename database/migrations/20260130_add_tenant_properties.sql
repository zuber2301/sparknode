-- Migration: 2026-01-30 - Add Comprehensive Tenant Properties
-- Adds theme_config, domain_whitelist, auth_method, currency_label, conversion_rate, 
-- auto_refill_threshold, award_tiers, peer_to_peer_enabled, expiry_policy

BEGIN;

-- Add new columns to tenants table
ALTER TABLE tenants
ADD COLUMN theme_config JSONB DEFAULT '{"primary_color": "#3B82F6", "secondary_color": "#8B5CF6", "font_family": "Inter"}',
ADD COLUMN domain_whitelist JSONB DEFAULT '[]',
ADD COLUMN auth_method VARCHAR(50) DEFAULT 'PASSWORD_AND_OTP',
ADD COLUMN currency_label VARCHAR(100) DEFAULT 'Points',
ADD COLUMN conversion_rate DECIMAL(10, 4) DEFAULT 1.0,
ADD COLUMN auto_refill_threshold DECIMAL(5, 2) DEFAULT 20.0,
ADD COLUMN award_tiers JSONB DEFAULT '{"Gold": 5000, "Silver": 2500, "Bronze": 1000}',
ADD COLUMN peer_to_peer_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN expiry_policy VARCHAR(50) DEFAULT 'NEVER';

-- Add CHECK constraint for auth_method if needed
ALTER TABLE tenants
ADD CONSTRAINT check_auth_method CHECK (auth_method IN ('PASSWORD_AND_OTP', 'OTP_ONLY', 'SSO_SAML'));

-- Add CHECK constraint for expiry_policy if needed  
ALTER TABLE tenants
ADD CONSTRAINT check_expiry_policy CHECK (expiry_policy IN ('NEVER', '90_DAYS', '1_YEAR', 'CUSTOM'));

COMMIT;
