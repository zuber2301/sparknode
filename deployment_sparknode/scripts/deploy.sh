#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# SparkNode — Deploy / Update script (Multi-Cloud, Image-Based)
# SSH into the VM, pull container images from DockerHub,
# update APP_VERSION, and restart services.
#
# Works with AWS, Azure, and GCP — auto-detects SSH user
# from Terraform outputs or via --provider flag.
#
# Usage:
#   ./deploy.sh --version abc1234                       # deploy specific tag
#   ./deploy.sh --version latest                        # deploy latest
#   ./deploy.sh --provider aws --host 1.2.3.4 --version abc1234
#   ./deploy.sh --provider azure --host 1.2.3.4 --version latest
#   ./deploy.sh --provider gcp --host 1.2.3.4 --key ~/.ssh/gcp_key --version v1.0.0
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Defaults ─────────────────────────────────────────────────
HOST="${DEPLOY_HOST:-}"
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/sparknode.pem}"
SSH_USER="${DEPLOY_SSH_USER:-}"
PROVIDER="${CLOUD_PROVIDER:-}"
VERSION="${APP_VERSION:-latest}"
DOCKERHUB_ORG="${DOCKERHUB_ORG:-zuber2301}"
APP_DIR="/opt/sparknode"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"

# ─── Parse arguments ─────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --host)     HOST="$2";          shift 2 ;;
    --key)      SSH_KEY="$2";       shift 2 ;;
    --user)     SSH_USER="$2";      shift 2 ;;
    --version)  VERSION="$2";       shift 2 ;;
    --org)      DOCKERHUB_ORG="$2"; shift 2 ;;
    --app-dir)  APP_DIR="$2";       shift 2 ;;
    --provider) PROVIDER="$2";      shift 2 ;;
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
echo "  SparkNode Deploy (Image-Based)"
echo "  Provider: ${PROVIDER:-auto}"
echo "  Host:     $HOST"
echo "  User:     $SSH_USER"
echo "  Version:  $VERSION"
echo "  Registry: $DOCKERHUB_ORG"
echo "═══════════════════════════════════════════════════════════"

# ─── 1. Pre-flight check ─────────────────────────────────────
echo ">>> Checking connectivity..."
$SSH_CMD "echo 'SSH OK'" || { echo "ERROR: Cannot reach $HOST"; exit 1; }

# ─── 2. Save current version for rollback ────────────────────
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
echo ">>> Saving current version for rollback reference..."
$SSH_CMD "grep '^APP_VERSION=' $APP_DIR/$ENV_FILE 2>/dev/null | cut -d= -f2 > $APP_DIR/backups/.previous_version_$TIMESTAMP" || true

# ─── 3. Database backup (pre-deploy) ────────────────────────
echo ">>> Backing up database..."
$SSH_CMD "mkdir -p $APP_DIR/backups && \
  docker exec ${APP_DIR##*/}-db pg_dump -U sparknode sparknode 2>/dev/null | \
  gzip > $APP_DIR/backups/pre-deploy-$TIMESTAMP.sql.gz" || echo "WARN: DB backup skipped (container not running?)"

# ─── 4. Update APP_VERSION in .env ──────────────────────────
echo ">>> Updating APP_VERSION to $VERSION..."
$SSH_CMD "cd $APP_DIR && \
  sed -i 's/^APP_VERSION=.*/APP_VERSION=$VERSION/' $ENV_FILE && \
  sed -i 's/^DOCKERHUB_ORG=.*/DOCKERHUB_ORG=$DOCKERHUB_ORG/' $ENV_FILE || \
  echo 'DOCKERHUB_ORG=$DOCKERHUB_ORG' >> $ENV_FILE"

# ─── 5. Pull images from DockerHub ──────────────────────────
echo ">>> Pulling images: $DOCKERHUB_ORG/sparknode-backend:$VERSION, $DOCKERHUB_ORG/sparknode-frontend:$VERSION..."
$SSH_CMD "cd $APP_DIR && \
  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE pull backend celery frontend"

# ─── 6. Restart containers with new images ──────────────────
echo ">>> Starting services with new images..."
$SSH_CMD "cd $APP_DIR && \
  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --remove-orphans"

# ─── 7. Wait for health ─────────────────────────────────────
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
    echo ">>> To rollback, run: ./rollback.sh --version <previous_version>"
    exit 1
  fi
  echo "  ... attempt $i/$MAX_RETRIES — waiting 10s"
  sleep 10
done

# ─── 8. Cleanup old images ──────────────────────────────────
echo ">>> Pruning unused Docker images..."
$SSH_CMD "docker image prune -f --filter 'until=168h'"

DOMAIN=$($SSH_CMD "grep '^DOMAIN=' $APP_DIR/$ENV_FILE | cut -d= -f2" 2>/dev/null || echo "")

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Deployment complete!"
echo "  Version: $VERSION"
echo "  URL:     https://$DOMAIN"
echo "═══════════════════════════════════════════════════════════"
