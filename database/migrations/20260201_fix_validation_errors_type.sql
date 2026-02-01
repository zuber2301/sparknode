-- Migration: Fix validation_errors column type
-- Date: 2026-02-01
-- Purpose: Change validation_errors from TEXT[] to JSONB to match ORM model

DO $$ 
BEGIN
    -- Check if validation_errors column exists and if it's the wrong type
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='validation_errors'
    ) THEN
        -- Drop the existing validation_errors column
        ALTER TABLE user_upload_staging DROP COLUMN validation_errors;
    END IF;
    
    -- Add validation_errors as JSONB with default empty array
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='validation_errors'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN validation_errors JSONB DEFAULT '[]'::jsonb;
    END IF;

END $$;
