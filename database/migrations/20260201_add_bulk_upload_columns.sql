-- Migration: Add missing columns to user_upload_staging table
-- Date: 2026-02-01
-- Purpose: Ensure user_upload_staging table has all required columns for bulk upload feature

-- Check if columns exist before adding them
DO $$ 
BEGIN
    -- Add raw_full_name if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='raw_full_name'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN raw_full_name VARCHAR(255);
    END IF;

    -- Add raw_email if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='raw_email'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN raw_email VARCHAR(255);
    END IF;

    -- Add raw_department if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='raw_department'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN raw_department VARCHAR(255);
    END IF;

    -- Add raw_role if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='raw_role'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN raw_role VARCHAR(50);
    END IF;

    -- Add raw_mobile_phone if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='raw_mobile_phone'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN raw_mobile_phone VARCHAR(20);
    END IF;

    -- Add manager_email if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='manager_email'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN manager_email VARCHAR(255);
    END IF;

    -- Add first_name if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='first_name'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN first_name VARCHAR(100);
    END IF;

    -- Add last_name if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='last_name'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN last_name VARCHAR(100);
    END IF;

    -- Add corporate_email if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='corporate_email'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN corporate_email VARCHAR(255);
    END IF;

    -- Add personal_email if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='personal_email'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN personal_email VARCHAR(255);
    END IF;

    -- Add date_of_birth if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='date_of_birth'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN date_of_birth VARCHAR(50);
    END IF;

    -- Add hire_date if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='hire_date'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN hire_date VARCHAR(50);
    END IF;

    -- Add manager_id if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='manager_id'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN manager_id UUID;
    END IF;

    -- Add is_valid if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='is_valid'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN is_valid BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add validation_errors if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='validation_errors'
    ) THEN
        ALTER TABLE user_upload_staging ADD COLUMN validation_errors JSONB DEFAULT '[]'::jsonb;
    END IF;

END $$;
