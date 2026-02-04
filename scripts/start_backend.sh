#!/usr/bin/env bash
set -euo pipefail

# Sparknode backend startup script
# Usage: ./scripts/start_backend.sh [migrate]
# If "migrate" is passed, the script will run the seed migration before starting.

WORKDIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="/tmp/sparknode_backend.log"
PIDFILE="/tmp/uvicorn.pid"
PORT=${SPARKNODE_PORT:-8000}
HOST=${SPARKNODE_HOST:-0.0.0.0}
PYTHON=${PYTHON:-python3}

echo "Working directory: $WORKDIR"

# Kill existing uvicorn instances running the app
pids=$(pgrep -f "uvicorn main:app" || true)
if [ -n "$pids" ]; then
  echo "Killing existing uvicorn pids: $pids"
  kill -9 $pids || true
fi

if [ "${1:-}" = "migrate" ]; then
  echo "Applying DB seed migration..."
  PGPASSWORD="${PGPASSWORD:-sparknode_secret_2024}" \
    psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-7432}" -U "${DB_USER:-sparknode}" -d "${DB_NAME:-sparknode}" \
    -f "$WORKDIR/database/migrations/20260205_fix_seed_passwords.sql"
fi

echo "Starting backend (uvicorn) on $HOST:$PORT, logs -> $LOG"
cd "$WORKDIR/backend" || exit 1
nohup $PYTHON -m uvicorn main:app --host $HOST --port $PORT > "$LOG" 2>&1 &
echo $! > "$PIDFILE"
echo "Started uvicorn pid=$(cat $PIDFILE), logs at $LOG"
