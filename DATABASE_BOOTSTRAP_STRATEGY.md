# Database Bootstrap Configuration Strategy

## Overview
SparkNode uses a **two-compose-file** approach to separate bootstrap initialization from runtime data persistence:

1. **docker-compose.yml** — Base production-safe configuration with persistent volume
2. **docker-compose.override.yml** — Bootstrap-only overrides for fresh database initialization

This prevents data loss during container rebuilds.

## Initial Setup (Fresh Database)

```bash
# 1. Create named external volume
docker volume create sparknode_postgres_data

# 2. Bootstrap with init scripts
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d

# 3. Wait for postgres to initialize and run seed
docker-compose logs -f postgres
```

The init scripts (`database/init.sql` and `database/seed.sql`) ONLY run on the first startup when the volume is empty. After that, the volume persists across container restarts.

## Normal Operations (Data Persists)

```bash
# Rebuild containers without losing database data
docker-compose up -d --build

# Rebuild only backend
docker-compose up -d --build backend

# View logs
docker-compose logs -f backend postgres
```

## Full Database Reset

```bash
# ⚠️  This deletes all data — use with caution!
docker-compose down -v
docker volume rm sparknode_postgres_data

# Reinitialize with fresh schema + seed
docker volume create sparknode_postgres_data
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

## Why This Approach?

| Scenario | Without Override | With Override |
|----------|------------------|---------------|
| **First Boot** | Init scripts run ✅ | Init scripts run ✅ |
| **Rebuild Backend** | DB persists ✅ | DB persists ✅ |
| **Rebuild All** | ❌ Data wiped, init scripts rerun (slow, data loss risk) | ✅ Data persists from volume |
| **Intentional Reset** | Complex (volume + service cleanup) | Simple (one command) |

Docker Compose reads `docker-compose.override.yml` automatically if it exists in the same directory. After first bootstrap, you only use the base file—the override doesn't cause problems.

## Configuration Details

**docker-compose.yml (Base)**
- Uses external named volume: `sparknode_postgres_data` (marked `external: true`)
- No init script mounts
- Alembic handles schema migrations at runtime

**docker-compose.override.yml (Bootstrap)**
- Adds init script mounts as overrides
- Only used on initial setup

This is standard Docker Compose practice for production environments.
