import os
from sqlalchemy import create_engine, Column, String, DateTime, JSON, Boolean, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sparknode:sparknode_secret_2024@localhost:7432/sparknode")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class InfrastructureApproval(Base):
    __tablename__ = "infra_approvals"

    id = Column(Integer, primary_key=True, index=True)
    deployment_id = Column(String, index=True)
    env_id = Column(String)
    provider = Column(String)
    plan_summary = Column(JSON)
    status = Column(String) # validated, polished, approved, rejected
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    variables = Column(JSON)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
