#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not in PATH."
  exit 1
fi

DC="docker compose"
if ! $DC version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    DC="docker-compose"
  else
    echo "Docker Compose not available."
    exit 1
  fi
fi

export POSTGRES_USER="${POSTGRES_USER:-sparknode}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-sparknode_secret_2024}"
export POSTGRES_DB="${POSTGRES_DB:-sparknode}"
export POSTGRES_EXTERNAL_PORT="${POSTGRES_EXTERNAL_PORT:-6432}"
export BACKEND_EXTERNAL_PORT="${BACKEND_EXTERNAL_PORT:-6100}"
export FRONTEND_EXTERNAL_PORT="${FRONTEND_EXTERNAL_PORT:-6173}"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

echo "Starting SparkNode containers..."
$DC up -d --build

echo "Waiting for Postgres to become healthy..."
for i in {1..30}; do
  if $DC exec -T postgres pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; then
    echo "Postgres is ready."
    break
  fi
  sleep 2
  if [[ $i -eq 30 ]]; then
    echo "Postgres did not become ready in time."
    $DC logs --tail=50 postgres
    exit 1
  fi
done

echo "Checking backend health..."
for i in {1..30}; do
  if curl -fsS "http://localhost:${BACKEND_EXTERNAL_PORT}/health" >/dev/null 2>&1; then
    echo "Backend is healthy."
    break
  fi
  sleep 2
  if [[ $i -eq 30 ]]; then
    echo "Backend health check failed."
    $DC logs --tail=50 backend
    exit 1
  fi
done

echo "Checking frontend health..."
for i in {1..30}; do
  if curl -fsS "http://localhost:${FRONTEND_EXTERNAL_PORT}" >/dev/null 2>&1; then
    echo "Frontend is reachable."
    break
  fi
  sleep 2
  if [[ $i -eq 30 ]]; then
    echo "Frontend check failed."
    $DC logs --tail=50 frontend
    exit 1
  fi
done

echo "Ensuring seed data is present..."
if [[ -f "$ROOT_DIR/database/seed.sql" ]]; then
  $DC exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$ROOT_DIR/database/seed.sql"
fi

REQUIRED_TENANTS=$($DC exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM tenants WHERE name IN ('Triton','Uniplane','jSpark','Zebra','All Tenants');" || echo "0")
REQUIRED_TENANTS="${REQUIRED_TENANTS//[[:space:]]/}"
if [[ "$REQUIRED_TENANTS" != "5" ]]; then
  echo "Warning: Expected 5 required tenants, found $REQUIRED_TENANTS."
else
  echo "Seed data verified (required tenants present)."
fi

echo "Container status:"
$DC ps

echo "Recent logs (tail=50):"
$DC logs --tail=50

echo "SparkNode environment is up and healthy."
