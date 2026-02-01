-- Migration: Make full_name and email nullable in user_upload_staging
-- Date: 2026-02-01
-- Purpose: Allow staging table to work with raw data without processed fields

DO $$ 
BEGIN
    -- Make full_name nullable
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='full_name' AND is_nullable='NO'
    ) THEN
        ALTER TABLE user_upload_staging ALTER COLUMN full_name DROP NOT NULL;
    END IF;

    -- Make email nullable
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='email' AND is_nullable='NO'
    ) THEN
        ALTER TABLE user_upload_staging ALTER COLUMN email DROP NOT NULL;
    END IF;

END $$;
