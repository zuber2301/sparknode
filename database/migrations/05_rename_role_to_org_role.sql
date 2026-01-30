-- Migration: Rename role to org_role and ensure all fields exist
ALTER TABLE users RENAME COLUMN role TO org_role;

-- The other fields already exist in the table according to init.sql, 
-- but we ensure they are there just in case they were missed in some environments.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='corporate_email') THEN
        ALTER TABLE users ADD COLUMN corporate_email VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='personal_email') THEN
        ALTER TABLE users ADD COLUMN personal_email VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mobile_number') THEN
        ALTER TABLE users ADD COLUMN mobile_number VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='date_of_birth') THEN
        ALTER TABLE users ADD COLUMN date_of_birth DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='hire_date') THEN
        ALTER TABLE users ADD COLUMN hire_date DATE;
    END IF;
END $$;
