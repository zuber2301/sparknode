#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# SparkNode — Rollback script
# Rolls back to the previous git tag and restores DB backup
#
# Usage:
#   ./rollback.sh                          # rollback to most recent pre-deploy tag
#   ./rollback.sh --tag pre-deploy-20260227-143000
#   ./rollback.sh --host 1.2.3.4 --key ~/.ssh/sparknode.pem
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Defaults ─────────────────────────────────────────────────
HOST="${DEPLOY_HOST:-}"
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/sparknode.pem}"
SSH_USER="${DEPLOY_SSH_USER:-ubuntu}"
APP_DIR="/opt/sparknode"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
ROLLBACK_TAG=""
RESTORE_DB=false

# ─── Parse arguments ─────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --host)       HOST="$2";         shift 2 ;;
    --key)        SSH_KEY="$2";      shift 2 ;;
    --user)       SSH_USER="$2";     shift 2 ;;
    --tag)        ROLLBACK_TAG="$2"; shift 2 ;;
    --restore-db) RESTORE_DB=true;   shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [ -z "$HOST" ]; then
  if command -v terraform &> /dev/null && [ -d "../terraform" ]; then
    HOST=$(cd ../terraform && terraform output -raw public_ip 2>/dev/null || true)
  fi
  if [ -z "$HOST" ]; then
    echo "ERROR: No host specified. Use --host <ip> or set DEPLOY_HOST env var"
    exit 1
  fi
fi

SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 $SSH_USER@$HOST"

echo "═══════════════════════════════════════════════════════════"
echo "  SparkNode Rollback"
echo "  Host: $HOST"
echo "═══════════════════════════════════════════════════════════"

# ─── 1. Find rollback target ─────────────────────────────────
if [ -z "$ROLLBACK_TAG" ]; then
  echo ">>> Finding most recent pre-deploy tag..."
  ROLLBACK_TAG=$($SSH_CMD "cd $APP_DIR && git tag -l 'pre-deploy-*' --sort=-creatordate | head -1")
  if [ -z "$ROLLBACK_TAG" ]; then
    echo "ERROR: No pre-deploy tags found. Cannot rollback."
    exit 1
  fi
fi

echo ">>> Rolling back to: $ROLLBACK_TAG"
read -rp "Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ─── 2. Restore database (if requested) ──────────────────────
if [ "$RESTORE_DB" = true ]; then
  DB_BACKUP_NAME="${ROLLBACK_TAG/pre-deploy-/pre-deploy-}"
  BACKUP_FILE="$APP_DIR/backups/$DB_BACKUP_NAME.sql.gz"

  echo ">>> Restoring database from $BACKUP_FILE ..."
  $SSH_CMD "test -f $BACKUP_FILE" || { echo "ERROR: Backup file not found: $BACKUP_FILE"; exit 1; }

  $SSH_CMD "gunzip -c $BACKUP_FILE | docker exec -i ${APP_DIR##*/}-db psql -U sparknode sparknode"
  echo ">>> Database restored."
fi

# ─── 3. Checkout the rollback tag ────────────────────────────
echo ">>> Checking out $ROLLBACK_TAG ..."
$SSH_CMD "cd $APP_DIR && git checkout $ROLLBACK_TAG"

# ─── 4. Copy production configs ──────────────────────────────
$SSH_CMD "cd $APP_DIR && \
  cp deployment_sparknode/docker/docker-compose.prod.yml $COMPOSE_FILE 2>/dev/null || true && \
  cp -r deployment_sparknode/docker/traefik/ traefik/ 2>/dev/null || true && \
  cp deployment_sparknode/docker/nginx.prod.conf frontend/nginx.prod.conf 2>/dev/null || true"

# ─── 5. Rebuild frontend ────────────────────────────────────
echo ">>> Rebuilding frontend..."
DOMAIN=$($SSH_CMD "grep '^DOMAIN=' $APP_DIR/$ENV_FILE | cut -d= -f2")
$SSH_CMD "cd $APP_DIR/frontend && \
  docker run --rm \
    -v $APP_DIR/frontend:/app \
    -w /app \
    -e VITE_API_URL=https://$DOMAIN \
    node:20-alpine \
    sh -c 'npm ci --production=false && npm run build'"

# ─── 6. Rebuild & restart ───────────────────────────────────
echo ">>> Rebuilding and restarting services..."
$SSH_CMD "cd $APP_DIR && \
  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE build --no-cache backend celery && \
  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --remove-orphans"

# ─── 7. Wait for health ─────────────────────────────────────
echo ">>> Waiting for services..."
sleep 10

for i in $(seq 1 6); do
  HEALTH=$($SSH_CMD "curl -sf http://localhost:8000/health 2>/dev/null || echo 'unhealthy'")
  if [ "$HEALTH" != "unhealthy" ]; then
    echo ">>> Backend is healthy!"
    break
  fi
  echo "  ... attempt $i/6 — waiting 10s"
  sleep 10
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Rollback to $ROLLBACK_TAG complete!"
echo "═══════════════════════════════════════════════════════════"
