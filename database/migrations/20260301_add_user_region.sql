-- Add region column to users for eligibility filtering
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS region TEXT;
