-- Migration: Add detailed HR fields to users table
-- Also for user_upload_staging

ALTER TABLE users ADD COLUMN IF NOT EXISTS corporate_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;

-- Populate corporate_email from email for existing users
UPDATE users SET corporate_email = email WHERE corporate_email IS NULL;

ALTER TABLE user_upload_staging ADD COLUMN IF NOT EXISTS corporate_email VARCHAR(255);
ALTER TABLE user_upload_staging ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);
ALTER TABLE user_upload_staging ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20);
ALTER TABLE user_upload_staging ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(50);
ALTER TABLE user_upload_staging ADD COLUMN IF NOT EXISTS hire_date VARCHAR(50);
