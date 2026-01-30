from sqlalchemy import create_engine, text

database_url = "postgresql://sparknode:sparknode_secret_2024@localhost:7432/sparknode"
engine = create_engine(database_url)

commands = [
    "ALTER TABLE users RENAME COLUMN role TO org_role;",
    "ALTER TABLE user_upload_staging RENAME COLUMN role TO org_role;"
]

with engine.connect() as conn:
    for cmd in commands:
        try:
            conn.execute(text(cmd))
            conn.commit()
            print(f"Executed: {cmd}")
        except Exception as e:
            print(f"Failed: {cmd} - {e}")
