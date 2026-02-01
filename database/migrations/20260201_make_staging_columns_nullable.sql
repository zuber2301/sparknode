-- Migration: Make non-raw columns nullable in user_upload_staging
-- Date: 2026-02-01
-- Purpose: Allow staging table to store raw data without processing all fields immediately

DO $$ 
BEGIN
    -- Make first_name nullable
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='first_name' AND is_nullable='NO'
    ) THEN
        ALTER TABLE user_upload_staging ALTER COLUMN first_name DROP NOT NULL;
    END IF;

    -- Make last_name nullable
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='last_name' AND is_nullable='NO'
    ) THEN
        ALTER TABLE user_upload_staging ALTER COLUMN last_name DROP NOT NULL;
    END IF;

    -- Make manager_email nullable
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='manager_email' AND is_nullable='NO'
    ) THEN
        ALTER TABLE user_upload_staging ALTER COLUMN manager_email DROP NOT NULL;
    END IF;

    -- Make corporate_email nullable
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='corporate_email' AND is_nullable='NO'
    ) THEN
        ALTER TABLE user_upload_staging ALTER COLUMN corporate_email DROP NOT NULL;
    END IF;

    -- Make personal_email nullable
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='personal_email' AND is_nullable='NO'
    ) THEN
        ALTER TABLE user_upload_staging ALTER COLUMN personal_email DROP NOT NULL;
    END IF;

    -- Make date_of_birth nullable
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='date_of_birth' AND is_nullable='NO'
    ) THEN
        ALTER TABLE user_upload_staging ALTER COLUMN date_of_birth DROP NOT NULL;
    END IF;

    -- Make hire_date nullable
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='hire_date' AND is_nullable='NO'
    ) THEN
        ALTER TABLE user_upload_staging ALTER COLUMN hire_date DROP NOT NULL;
    END IF;

    -- Make department_id nullable
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='department_id' AND is_nullable='NO'
    ) THEN
        ALTER TABLE user_upload_staging ALTER COLUMN department_id DROP NOT NULL;
    END IF;

    -- Make manager_id nullable
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='user_upload_staging' AND column_name='manager_id' AND is_nullable='NO'
    ) THEN
        ALTER TABLE user_upload_staging ALTER COLUMN manager_id DROP NOT NULL;
    END IF;

END $$;
