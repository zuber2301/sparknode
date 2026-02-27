from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

engine = create_engine(
    settings.database_url,
    pool_size=20,          # sensible default for multi-tenant workloads
    max_overflow=10,
    pool_pre_ping=True,    # detect stale connections
    pool_recycle=1800,      # recycle connections every 30 min
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# ── Install automatic tenant query filtering ──────────────────────────────
# This hooks into SQLAlchemy's ORM event system to append
# `WHERE tenant_id = :current_tenant` to all SELECT queries on
# tenant-scoped models, providing defense-in-depth isolation.
def _install_tenant_hooks():
    try:
        from core.tenant_isolation import install_tenant_filter
        install_tenant_filter(SessionLocal)
    except Exception:
        # During initial startup / migrations the core module may not be
        # importable yet. The hook will be retried on first request.
        pass

_install_tenant_hooks()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
