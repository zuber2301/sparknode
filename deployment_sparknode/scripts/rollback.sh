#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# SparkNode — Rollback script (Multi-Cloud, Image-Based)
# Rolls back to a previous container image version and
# optionally restores a database backup.
#
# Usage:
#   ./rollback.sh --version abc1234                     # rollback to specific image tag
#   ./rollback.sh --version abc1234 --restore-db        # also restore DB
#   ./rollback.sh --provider azure --host 1.2.3.4 --version abc1234
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Defaults ─────────────────────────────────────────────────
HOST="${DEPLOY_HOST:-}"
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/sparknode.pem}"
SSH_USER="${DEPLOY_SSH_USER:-}"
PROVIDER="${CLOUD_PROVIDER:-}"
DOCKERHUB_ORG="${DOCKERHUB_ORG:-zuber2301}"
APP_DIR="/opt/sparknode"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
ROLLBACK_VERSION=""
RESTORE_DB=false
DB_BACKUP_FILE=""

# ─── Parse arguments ─────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --host)       HOST="$2";             shift 2 ;;
    --key)        SSH_KEY="$2";          shift 2 ;;
    --user)       SSH_USER="$2";         shift 2 ;;
    --version)    ROLLBACK_VERSION="$2"; shift 2 ;;
    --org)        DOCKERHUB_ORG="$2";    shift 2 ;;
    --restore-db) RESTORE_DB=true;       shift ;;
    --db-backup)  DB_BACKUP_FILE="$2";   shift 2 ;;
    --provider)   PROVIDER="$2";         shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Resolve from Terraform outputs ──────────────────────────
TF_DIR="../terraform"
if command -v terraform &> /dev/null && [ -d "$TF_DIR" ]; then
  if [ -z "$HOST" ]; then
    HOST=$(cd "$TF_DIR" && terraform output -raw public_ip 2>/dev/null || true)
  fi
  if [ -z "$SSH_USER" ]; then
    SSH_USER=$(cd "$TF_DIR" && terraform output -raw ssh_user 2>/dev/null || true)
  fi
  if [ -z "$PROVIDER" ]; then
    PROVIDER=$(cd "$TF_DIR" && terraform output -raw cloud_provider 2>/dev/null || true)
  fi
fi

# ─── Default SSH user per provider ───────────────────────────
if [ -z "$SSH_USER" ]; then
  case "$PROVIDER" in
    aws)   SSH_USER="ubuntu" ;;
    azure) SSH_USER="azureuser" ;;
    gcp)   SSH_USER="ubuntu" ;;
    *)     SSH_USER="ubuntu" ;;
  esac
fi

if [ -z "$HOST" ]; then
  echo "ERROR: No host specified. Use --host <ip> or set DEPLOY_HOST env var"
  exit 1
fi

SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 $SSH_USER@$HOST"

# ─── Find rollback version ───────────────────────────────────
if [ -z "$ROLLBACK_VERSION" ]; then
  echo ">>> No --version specified. Looking for previous version on VM..."
  ROLLBACK_VERSION=$($SSH_CMD "ls -t $APP_DIR/backups/.previous_version_* 2>/dev/null | head -1 | xargs cat 2>/dev/null" || true)
  if [ -z "$ROLLBACK_VERSION" ]; then
    echo "ERROR: No previous version found. Specify --version <tag>"
    exit 1
  fi
  echo ">>> Found previous version: $ROLLBACK_VERSION"
fi

echo "═══════════════════════════════════════════════════════════"
echo "  SparkNode Rollback (Image-Based)"
echo "  Provider:  ${PROVIDER:-auto}"
echo "  Host:      $HOST"
echo "  User:      $SSH_USER"
echo "  Rollback:  $ROLLBACK_VERSION"
echo "  Registry:  $DOCKERHUB_ORG"
echo "═══════════════════════════════════════════════════════════"

read -rp "Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ─── 1. Restore database (if requested) ──────────────────────
if [ "$RESTORE_DB" = true ]; then
  if [ -z "$DB_BACKUP_FILE" ]; then
    echo ">>> Finding most recent database backup..."
    DB_BACKUP_FILE=$($SSH_CMD "ls -t $APP_DIR/backups/pre-deploy-*.sql.gz 2>/dev/null | head -1")
  fi

  if [ -z "$DB_BACKUP_FILE" ]; then
    echo "ERROR: No database backup found. Use --db-backup <path>"
    exit 1
  fi

  echo ">>> Restoring database from $DB_BACKUP_FILE ..."
  $SSH_CMD "test -f $DB_BACKUP_FILE" || { echo "ERROR: Backup file not found: $DB_BACKUP_FILE"; exit 1; }
  $SSH_CMD "gunzip -c $DB_BACKUP_FILE | docker exec -i sparknode-db psql -U sparknode sparknode"
  echo ">>> Database restored."
fi

# ─── 2. Update APP_VERSION to rollback version ──────────────
echo ">>> Setting APP_VERSION to $ROLLBACK_VERSION..."
$SSH_CMD "cd $APP_DIR && \
  sed -i 's/^APP_VERSION=.*/APP_VERSION=$ROLLBACK_VERSION/' $ENV_FILE"

# ─── 3. Pull the rollback images ────────────────────────────
echo ">>> Pulling images: $DOCKERHUB_ORG/sparknode-backend:$ROLLBACK_VERSION, $DOCKERHUB_ORG/sparknode-frontend:$ROLLBACK_VERSION..."
$SSH_CMD "cd $APP_DIR && \
  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE pull backend celery frontend"

# ─── 4. Restart services with rollback images ───────────────
echo ">>> Restarting services..."
$SSH_CMD "cd $APP_DIR && \
  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --remove-orphans"

# ─── 5. Wait for health ─────────────────────────────────────
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
echo "  ✓ Rollback to version $ROLLBACK_VERSION complete!"
echo "═══════════════════════════════════════════════════════════"
