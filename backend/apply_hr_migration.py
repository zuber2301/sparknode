from sqlalchemy import create_engine, text

database_url = "postgresql://sparknode:sparknode_secret_2024@localhost:7432/sparknode"
engine = create_engine(database_url)

commands = [
    # Rename role to org_role if it exists
    "DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN ALTER TABLE users RENAME COLUMN role TO org_role; END IF; END $$;",
    "DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_upload_staging' AND column_name='role') THEN ALTER TABLE user_upload_staging RENAME COLUMN role TO org_role; END IF; END $$;",
    
    # Add new columns
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS corporate_email VARCHAR(255);",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20);",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;",
    "UPDATE users SET corporate_email = email WHERE corporate_email IS NULL;",
    
    "ALTER TABLE user_upload_staging ADD COLUMN IF NOT EXISTS corporate_email VARCHAR(255);",
    "ALTER TABLE user_upload_staging ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);",
    "ALTER TABLE user_upload_staging ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20);",
    "ALTER TABLE user_upload_staging ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(50);",
    "ALTER TABLE user_upload_staging ADD COLUMN IF NOT EXISTS hire_date VARCHAR(50);"
]

with open("migration_log.txt", "w") as log:
    with engine.connect() as conn:
        for cmd in commands:
            try:
                conn.execute(text(cmd))
                conn.commit()
                log.write(f"Executed: {cmd[:50]}...\n")
            except Exception as e:
                log.write(f"Failed: {cmd[:50]}... - {e}\n")
