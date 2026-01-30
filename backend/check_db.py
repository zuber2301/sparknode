from sqlalchemy import create_engine, inspect

database_url = "postgresql://sparknode:sparknode_secret_2024@localhost:7432/sparknode"
engine = create_engine(database_url)
inspector = inspect(engine)
columns = [c['name'] for c in inspector.get_columns('users')]
with open("db_columns.txt", "w") as f:
    f.write(",".join(columns))
