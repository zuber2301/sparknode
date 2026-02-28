#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────
# SparkNode — GCP Deploy Script
# Phase 1: terraform init + apply (provisions VPC, static IP, VM)
# Phase 2: Docker Compose + Traefik container rollout
# Mirrors the structure of deploy_aws.sh / deploy_azure.sh
# ──────────────────────────────────────────────────────────────

TF_DIR="/root/repos_products/sparknode/deployment_sparknode/terraform/modules/gcp"
APP_DIR="/opt/sparknode"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
VERSION="${APP_VERSION:-latest}"
DOCKERHUB_ORG="${DOCKERHUB_ORG:-zuber2301}"
SKIP_TERRAFORM="${SKIP_TERRAFORM:-false}"

# ──────────────────────────────────────────────────────────────
# Phase 1 — Terraform Infrastructure
# ──────────────────────────────────────────────────────────────
if [ "$SKIP_TERRAFORM" = "true" ]; then
    echo ">>> Bypassing Phase 1 (SKIP_TERRAFORM=true) — container-only deploy"
else
    echo ">>> Phase 1: Provisioning GCP Infrastructure via Terraform..."
    cd "$TF_DIR"

    ENV_TYPE="${ENVIRONMENT:-dev}"
    STATE_PATH="../../tfstate/gcp/$ENV_TYPE/terraform.tfstate"

    echo ">>> Initializing with state backend: $STATE_PATH"
    mkdir -p "$(dirname "$STATE_PATH")"
    terraform init -reconfigure -backend-config="path=$STATE_PATH" > /dev/null

    TF_TARGET=""
    if [ "${TF_TARGET_VM_ONLY:-false}" = "true" ]; then
        echo ">>> TARGETING: google_compute_instance.sparknode ONLY"
        TF_TARGET="-target=google_compute_instance.sparknode"
    fi

    terraform apply $TF_TARGET -auto-approve > /dev/null
fi

# ──────────────────────────────────────────────────────────────
# Fetch Infrastructure Metadata from Terraform State
# ──────────────────────────────────────────────────────────────
cd "$TF_DIR"

ENV_TYPE="${ENVIRONMENT:-dev}"
STATE_PATH="../../tfstate/gcp/$ENV_TYPE/terraform.tfstate"
if [ "$SKIP_TERRAFORM" = "true" ]; then
    terraform init -reconfigure -backend-config="path=$STATE_PATH" > /dev/null 2>&1 || true
fi

HOST=$(terraform output -raw public_ip 2>/dev/null || echo "")
SSH_USER=$(terraform output -raw ssh_user 2>/dev/null || echo "ubuntu")
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/sparknode_gcp}"

if [ -z "$HOST" ]; then
    echo "ERROR: Could not determine host IP from Terraform state."
    echo "       Has Phase 1 (infra provisioning) been completed for this environment?"
    exit 1
fi

echo ">>> Infrastructure Ready at $HOST"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  SparkNode Deploy Sequence (GCP)"
echo "  Host:     $HOST"
echo "  User:     $SSH_USER"
echo "  Version:  $VERSION"
echo "════════════════════════════════════════════════════════════"

SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=15 -o BatchMode=yes $SSH_USER@$HOST"

# ──────────────────────────────────────────────────────────────
# Phase 2 — Container Rollout
# ──────────────────────────────────────────────────────────────

# 1. Connectivity check
echo ">>> Gateway Check: Verifying SSH access to GCP VM..."
$SSH_CMD "echo 'SSH/Networking OK'" || { echo "ERROR: Cannot SSH to $HOST"; exit 1; }

# 2. Docker check / install if missing
echo ">>> Verifying Docker is installed..."
$SSH_CMD "docker --version > /dev/null 2>&1 || (apt-get update -y && curl -fsSL https://get.docker.com | sh && systemctl enable docker && systemctl start docker)"

# 3. Ensure app directory exists
echo ">>> Ensuring application directory exists..."
$SSH_CMD "mkdir -p $APP_DIR/traefik/acme $APP_DIR/traefik/dynamic $APP_DIR/backups"

# 4. Pre-deploy database backup (non-fatal)
echo ">>> Backing up database (pre-deploy)..."
$SSH_CMD "docker exec sparknode-db pg_dump -U sparknode sparknode 2>/dev/null | gzip > $APP_DIR/backups/pre-deploy-\$(date +%Y%m%d-%H%M).sql.gz" \
    || echo "WARN: DB backup skipped (container may not be running yet)"

# 5. Update APP_VERSION and pull latest images
echo ">>> Updating APP_VERSION=$VERSION and pulling images..."
$SSH_CMD "cd $APP_DIR && \
    sed -i 's/^APP_VERSION=.*/APP_VERSION=$VERSION/' $ENV_FILE 2>/dev/null || echo 'APP_VERSION=$VERSION' >> $ENV_FILE && \
    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE pull backend celery frontend"

# 6. Restart services
echo ">>> Starting / restarting services..."
$SSH_CMD "cd $APP_DIR && docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --remove-orphans"

# 7. Run DB migrations
echo ">>> Running database migrations..."
sleep 12
BACKEND_CONTAINER=$($SSH_CMD "docker compose -f $APP_DIR/$COMPOSE_FILE ps -q backend 2>/dev/null | head -1" || echo "")
if [ -n "$BACKEND_CONTAINER" ]; then
    $SSH_CMD "docker exec $BACKEND_CONTAINER python -m alembic upgrade head" || echo "WARN: Migration skipped"
else
    echo "WARN: Backend container not found for migration"
fi

# 8. Health check
echo ">>> Waiting for services to become healthy..."
sleep 8
HEALTH=$($SSH_CMD "curl -sf http://localhost:8000/health 2>/dev/null && echo 'healthy' || echo 'unhealthy'")
if [ "$HEALTH" = "healthy" ]; then
    echo ">>> ✓ Deployment complete! (GCP)"
    echo ">>> App stack running at: https://$HOST"
else
    echo "ERROR: Backend did not return healthy after deploy."
    exit 1
fi
