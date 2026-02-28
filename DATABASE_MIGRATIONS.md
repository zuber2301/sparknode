# Database Migrations — Architecture & Operations

## Architecture

SparkNode uses **Alembic** as the single source of truth for database schema
management. The migration chain lives under `backend/alembic/versions/`.

| Revision | Purpose |
|---|---|
| `0001_tenant_isolation` | Add `tenant_id` to several tables, NOT NULL on `audit_log.tenant_id` |
| `0002_consolidate_raw_sql` | Bridge — brings all 27 legacy `database/migrations/*.sql` files into Alembic |
| `0003_seed_ddl_extraction` | DDL that was previously embedded in `database/seed.sql` |

### How it works

| Scenario | What happens |
|---|---|
| **Fresh database (first `docker compose up`)** | Postgres runs `init.sql` + `seed.sql` (via `docker-entrypoint-initdb.d/`), then the backend entrypoint runs `alembic upgrade head`. Because all migrations are idempotent (IF NOT EXISTS), they safely no-op. |
| **Existing database (subsequent deploys)** | Backend entrypoint runs `alembic upgrade head`, applying only new migrations. |
| **CI tests** | `alembic upgrade head` is run before `pytest`. |

### File roles

| File | Role |
|---|---|
| `database/init.sql` | Monolithic bootstrap — creates all tables on first Postgres boot. **Not a migration tool.** |
| `database/seed.sql` | **Data only** — demo tenants, users, wallets. No DDL. |
| `database/migrations/*.sql` | **Legacy** — now consolidated into Alembic `0002`. Kept for reference only. |
| `backend/alembic/versions/*.py` | **Source of truth** for all schema changes going forward. |

## Operations

### Creating a new migration

```bash
cd backend
alembic revision --autogenerate -m "describe_the_change"
# Review the generated file, then commit
```

### Applying migrations (happens automatically)

The backend Docker entrypoint runs `alembic upgrade head` on every container
start. For manual runs:

```bash
# Inside the backend container
docker exec <backend-container> python -m alembic upgrade head

# Or from host with database access
cd backend && alembic upgrade head
```

### Stamping an existing production database

If your production database already has all tables but has never run Alembic,
stamp it to mark the current migration as applied **without executing SQL**:

```bash
docker exec <backend-container> python -m alembic stamp 0003_seed_ddl_extraction
```

This records `0001`, `0002`, and `0003` as applied so future migrations start
from `0003`.

### Checking current revision

```bash
docker exec <backend-container> python -m alembic current
```

### Viewing migration history

```bash
docker exec <backend-container> python -m alembic history --verbose
```

### Rolling back (one step)

```bash
docker exec <backend-container> python -m alembic downgrade -1
```

> **Note:** Migrations `0002` and `0003` have no-op downgrades (use DB backup).

## Best Practices Checklist

- [x] **Never rely on ad-hoc SQL** — all DDL goes through Alembic
- [x] **Schema in source control** — `backend/alembic/versions/` is committed
- [x] **Separate dev/test/prod databases** — same migrations run in all environments
- [x] **Automate migrations in CI/CD** — entrypoint runs `alembic upgrade head`;
      deploy pipeline runs it explicitly after image pull
