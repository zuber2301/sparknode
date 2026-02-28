#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# SparkNode — Deploy / Update script (Multi-Cloud)
# SSH into the VM, pull latest code, rebuild & restart
#
# Works with AWS, Azure, and GCP — auto-detects SSH user
# from Terraform outputs or via --provider flag.
#
# Usage:
#   ./deploy.sh                                         # auto-detect from TF
#   ./deploy.sh --provider aws --host 1.2.3.4
#   ./deploy.sh --provider azure --host 1.2.3.4
#   ./deploy.sh --provider gcp --host 1.2.3.4 --key ~/.ssh/gcp_key
#   ./deploy.sh --branch release/v2.1
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Defaults ─────────────────────────────────────────────────
HOST="${DEPLOY_HOST:-}"
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/sparknode.pem}"
SSH_USER="${DEPLOY_SSH_USER:-}"
BRANCH="${DEPLOY_BRANCH:-main}"
PROVIDER="${CLOUD_PROVIDER:-}"
APP_DIR="/opt/sparknode"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"

# ─── Parse arguments ─────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --host)     HOST="$2";     shift 2 ;;
    --key)      SSH_KEY="$2";  shift 2 ;;
    --user)     SSH_USER="$2"; shift 2 ;;
    --branch)   BRANCH="$2";  shift 2 ;;
    --app-dir)  APP_DIR="$2"; shift 2 ;;
    --provider) PROVIDER="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Resolve from Terraform outputs if not set ───────────────
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

echo "═══════════════════════════════════════════════════════════"
echo "  SparkNode Deploy"
echo "  Provider: ${PROVIDER:-auto}"
echo "  Host:     $HOST"
echo "  User:     $SSH_USER"
echo "  Branch:   $BRANCH"
echo "  Dir:      $APP_DIR"
echo "═══════════════════════════════════════════════════════════"

# ─── 1. Pre-flight check ─────────────────────────────────────
echo ">>> Checking connectivity..."
$SSH_CMD "echo 'SSH OK'" || { echo "ERROR: Cannot reach $HOST"; exit 1; }

# ─── 2. Create backup tag ────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
echo ">>> Creating pre-deploy snapshot tag: deploy-$TIMESTAMP"
$SSH_CMD "cd $APP_DIR && git tag -f pre-deploy-$TIMESTAMP HEAD 2>/dev/null || true"

# ─── 3. Pull latest code ─────────────────────────────────────
echo ">>> Pulling branch: $BRANCH"
$SSH_CMD "cd $APP_DIR && git fetch origin && git checkout $BRANCH && git pull origin $BRANCH"

# ─── 4. Copy production compose & configs ────────────────────
echo ">>> Syncing production config..."
$SSH_CMD "cd $APP_DIR && \
  cp deployment_sparknode/docker/docker-compose.prod.yml $COMPOSE_FILE && \
  cp -r deployment_sparknode/docker/traefik/ traefik/ && \
  cp deployment_sparknode/docker/nginx.prod.conf frontend/nginx.prod.conf"

# ─── 5. Build frontend ──────────────────────────────────────
echo ">>> Building frontend assets..."
DOMAIN=$($SSH_CMD "grep '^DOMAIN=' $APP_DIR/$ENV_FILE | cut -d= -f2")
$SSH_CMD "cd $APP_DIR/frontend && \
  docker run --rm \
    -v $APP_DIR/frontend:/app \
    -w /app \
    -e VITE_API_URL=https://$DOMAIN \
    node:20-alpine \
    sh -c 'npm ci --production=false && npm run build'"

# ─── 6. Database backup (pre-deploy) ────────────────────────
echo ">>> Backing up database..."
$SSH_CMD "docker exec ${APP_DIR##*/}-db pg_dump -U sparknode sparknode 2>/dev/null | \
  gzip > $APP_DIR/backups/pre-deploy-$TIMESTAMP.sql.gz" || echo "WARN: DB backup skipped (container not running?)"

# ─── 7. Build & restart containers ──────────────────────────
echo ">>> Building and restarting services..."
$SSH_CMD "cd $APP_DIR && \
  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE build --no-cache backend celery && \
  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --remove-orphans"

# ─── 8. Wait for health ─────────────────────────────────────
echo ">>> Waiting for services to become healthy..."
sleep 10

MAX_RETRIES=12
for i in $(seq 1 $MAX_RETRIES); do
  HEALTH=$($SSH_CMD "curl -sf http://localhost:8000/health 2>/dev/null || echo 'unhealthy'")
  if [ "$HEALTH" != "unhealthy" ]; then
    echo ">>> Backend is healthy!"
    break
  fi
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    echo "ERROR: Backend did not become healthy in time"
    echo ">>> Rolling back..."
    $SSH_CMD "cd $APP_DIR && git checkout pre-deploy-$TIMESTAMP 2>/dev/null && \
      docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --remove-orphans"
    exit 1
  fi
  echo "  ... attempt $i/$MAX_RETRIES — waiting 10s"
  sleep 10
done

# ─── 9. Cleanup old images ──────────────────────────────────
echo ">>> Pruning unused Docker images..."
$SSH_CMD "docker image prune -f --filter 'until=168h'"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Deployment complete!"
echo "  URL: https://$DOMAIN"
echo "═══════════════════════════════════════════════════════════"
