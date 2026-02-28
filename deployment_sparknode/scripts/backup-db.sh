#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# SparkNode — PostgreSQL Backup Script (Multi-Cloud)
# Creates a gzipped SQL dump and optionally uploads to cloud
# storage (S3, Azure Blob, or GCS).
#
# Usage:
#   ./backup-db.sh                                          # local backup
#   ./backup-db.sh --provider aws --host 1.2.3.4 --s3 s3://my-bucket/sparknode/
#   ./backup-db.sh --provider azure --host 1.2.3.4 --blob https://account.blob.core.windows.net/container
#   ./backup-db.sh --provider gcp --host 1.2.3.4 --gcs gs://my-bucket/sparknode/
# ──────────────────────────────────────────────────────────────
set -euo pipefail

HOST="${DEPLOY_HOST:-}"
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/sparknode.pem}"
SSH_USER="${DEPLOY_SSH_USER:-}"
PROVIDER="${CLOUD_PROVIDER:-}"
APP_DIR="/opt/sparknode"
S3_DEST=""
BLOB_DEST=""
GCS_DEST=""
CONTAINER_NAME="sparknode-db"
DB_USER="sparknode"
DB_NAME="sparknode"

while [[ $# -gt 0 ]]; do
  case $1 in
    --host)     HOST="$2";      shift 2 ;;
    --key)      SSH_KEY="$2";   shift 2 ;;
    --user)     SSH_USER="$2";  shift 2 ;;
    --provider) PROVIDER="$2";  shift 2 ;;
    --s3)       S3_DEST="$2";   shift 2 ;;
    --blob)     BLOB_DEST="$2"; shift 2 ;;
    --gcs)      GCS_DEST="$2";  shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Resolve from Terraform outputs ──────────────────────────
TF_DIR="../terraform"
if command -v terraform &> /dev/null && [ -d "$TF_DIR" ]; then
  if [ -z "$HOST" ] && [ -z "$HOST" ]; then
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

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="sparknode-backup-$TIMESTAMP.sql.gz"

if [ -n "$HOST" ]; then
  # Remote backup via SSH
  SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SSH_USER@$HOST"
  echo ">>> Creating database backup on $HOST (provider: ${PROVIDER:-auto})..."

  $SSH_CMD "docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME | gzip > $APP_DIR/backups/$BACKUP_FILE"
  echo ">>> Backup created: $APP_DIR/backups/$BACKUP_FILE"

  # Upload to cloud storage
  if [ -n "$S3_DEST" ]; then
    scp -i "$SSH_KEY" "$SSH_USER@$HOST:$APP_DIR/backups/$BACKUP_FILE" "/tmp/$BACKUP_FILE"
    aws s3 cp "/tmp/$BACKUP_FILE" "${S3_DEST}${BACKUP_FILE}"
    rm -f "/tmp/$BACKUP_FILE"
    echo ">>> Uploaded to $S3_DEST$BACKUP_FILE"
  elif [ -n "$BLOB_DEST" ]; then
    scp -i "$SSH_KEY" "$SSH_USER@$HOST:$APP_DIR/backups/$BACKUP_FILE" "/tmp/$BACKUP_FILE"
    az storage blob upload --file "/tmp/$BACKUP_FILE" --container-name "$(basename "$BLOB_DEST")" --name "$BACKUP_FILE" --overwrite
    rm -f "/tmp/$BACKUP_FILE"
    echo ">>> Uploaded to Azure Blob: $BACKUP_FILE"
  elif [ -n "$GCS_DEST" ]; then
    scp -i "$SSH_KEY" "$SSH_USER@$HOST:$APP_DIR/backups/$BACKUP_FILE" "/tmp/$BACKUP_FILE"
    gsutil cp "/tmp/$BACKUP_FILE" "${GCS_DEST}${BACKUP_FILE}"
    rm -f "/tmp/$BACKUP_FILE"
    echo ">>> Uploaded to $GCS_DEST$BACKUP_FILE"
  fi
else
  # Local backup (running on the VM itself)
  echo ">>> Creating local database backup..."
  docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME | gzip > "$APP_DIR/backups/$BACKUP_FILE"
  echo ">>> Backup created: $APP_DIR/backups/$BACKUP_FILE"

  if [ -n "$S3_DEST" ]; then
    aws s3 cp "$APP_DIR/backups/$BACKUP_FILE" "${S3_DEST}${BACKUP_FILE}"
    echo ">>> Uploaded to $S3_DEST$BACKUP_FILE"
  elif [ -n "$BLOB_DEST" ]; then
    az storage blob upload --file "$APP_DIR/backups/$BACKUP_FILE" --container-name "$(basename "$BLOB_DEST")" --name "$BACKUP_FILE" --overwrite
    echo ">>> Uploaded to Azure Blob: $BACKUP_FILE"
  elif [ -n "$GCS_DEST" ]; then
    gsutil cp "$APP_DIR/backups/$BACKUP_FILE" "${GCS_DEST}${BACKUP_FILE}"
    echo ">>> Uploaded to $GCS_DEST$BACKUP_FILE"
  fi
fi

# Cleanup old local backups (keep 7 days)
if [ -n "$HOST" ]; then
  SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SSH_USER@$HOST"
  $SSH_CMD "find $APP_DIR/backups -name 'sparknode-backup-*.sql.gz' -mtime +7 -delete 2>/dev/null || true"
else
  find "$APP_DIR/backups" -name 'sparknode-backup-*.sql.gz' -mtime +7 -delete 2>/dev/null || true
fi

echo ">>> Backup complete: $BACKUP_FILE"
