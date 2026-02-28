#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ──────────────────────────────────────────
TF_DIR="/root/repos_products/sparknode/deployment_sparknode/terraform/modules/aws"
APP_DIR="/opt/sparknode"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
VERSION="${APP_VERSION:-latest}"
DOCKERHUB_ORG="zuber2301"
SKIP_TERRAFORM="${SKIP_TERRAFORM:-false}"

if [ "$SKIP_TERRAFORM" = "true" ]; then
    echo ">>> Bypassing Step 1 (SKIP_TERRAFORM=true)..."
else
    echo ">>> Step 1: Provisioning Foundational Infrastructure (Terraform)..."
    cd "$TF_DIR"
    
    # Unified State Management (Issue #10)
    ENV_TYPE="${ENVIRONMENT:-dev}"
    STATE_PATH="../../tfstate/aws/$ENV_TYPE/terraform.tfstate"
    
    echo ">>> Initializing with state: $STATE_PATH"
    terraform init -reconfigure -backend-config="path=$STATE_PATH" > /dev/null
    
    # Check for VM-only targeting
    TF_TARGET=""
    if [ "${TF_TARGET_VM_ONLY:-false}" = "true" ]; then
        echo ">>> TARGETING: aws_instance ONLY"
        TF_TARGET="-target=aws_instance.sparknode_vm"
    fi

    # Pass any TF_VAR_* environment variables automatically
    terraform apply $TF_TARGET -auto-approve > /dev/null
fi

# ─── Fetch Infrastructure Metadata ──────────────────────────
HOST=$(terraform output -raw public_ip)
SSH_USER=$(terraform output -raw ssh_user)
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/sparknode.pem}"

echo ">>> Infrastructure Ready at $HOST"
echo ">>> Step 2: Deploying App Stack (Docker Compose)..."

echo "═══════════════════════════════════════════════════════════"
echo "  SparkNode Deploy Sequence (AWS)"
echo "  Host:     $HOST"
echo "  User:     $SSH_USER"
echo "  Version:  $VERSION"
echo "═══════════════════════════════════════════════════════════"

SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 $SSH_USER@$HOST"

# ─── 1. Pre-flight check / Networking Check ──────────────────
echo ">>> Gateway Check: Verifying Traefik/Nginx layer..."
$SSH_CMD "echo 'SSH/Networking OK'" || { echo "ERROR: Cannot reach $HOST"; exit 1; }

# ─── 2. Database backup (pre-deploy) ────────────────────────
echo ">>> Backing up database..."
$SSH_CMD "mkdir -p $APP_DIR/backups &&   docker exec ${APP_DIR##*/}-db pg_dump -U sparknode sparknode 2>/dev/null |   gzip > $APP_DIR/backups/pre-deploy-$(date +%Y%m%d).sql.gz" || echo "WARN: DB backup skipped"

# ─── 3. Update APP_VERSION & Pull ──────────────────────────
echo ">>> Updating APP_VERSION to $VERSION and pulling images..."
$SSH_CMD "cd $APP_DIR &&   sed -i 's/^APP_VERSION=.*/APP_VERSION=$VERSION/' $ENV_FILE &&   docker compose -f $COMPOSE_FILE --env-file $ENV_FILE pull backend celery frontend"

# ─── 4. Restart & Migrate ───────────────────────────────────
echo ">>> Starting services..."
$SSH_CMD "cd $APP_DIR &&   docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --remove-orphans"

echo ">>> Running Alembic migrations..."
sleep 10
$SSH_CMD "docker exec $(docker compose -f $APP_DIR/$COMPOSE_FILE ps -q backend) python -m alembic upgrade head"

# ─── 5. Health Check ────────────────────────────────────────
echo ">>> Waiting for services to become healthy..."
sleep 10
HEALTH=$($SSH_CMD "curl -sf http://localhost:8000/health 2>/dev/null || echo 'unhealthy'")
if [ "$HEALTH" != "unhealthy" ]; then
  echo ">>> ✓ Deployment complete! (AWS)"
else
  echo "ERROR: Backend did not become healthy"
  exit 1
fi
