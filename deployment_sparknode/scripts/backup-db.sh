#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# SparkNode — PostgreSQL Backup Script
# Creates a gzipped SQL dump and optionally uploads to S3
#
# Usage:
#   ./backup-db.sh                             # local backup
#   ./backup-db.sh --host 1.2.3.4 --s3 s3://my-bucket/sparknode/
# ──────────────────────────────────────────────────────────────
set -euo pipefail

HOST="${DEPLOY_HOST:-}"
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/sparknode.pem}"
SSH_USER="${DEPLOY_SSH_USER:-ubuntu}"
APP_DIR="/opt/sparknode"
S3_DEST=""
CONTAINER_NAME="sparknode-db"
DB_USER="sparknode"
DB_NAME="sparknode"

while [[ $# -gt 0 ]]; do
  case $1 in
    --host) HOST="$2";   shift 2 ;;
    --key)  SSH_KEY="$2"; shift 2 ;;
    --s3)   S3_DEST="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="sparknode-backup-$TIMESTAMP.sql.gz"

if [ -n "$HOST" ]; then
  # Remote backup via SSH
  SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SSH_USER@$HOST"
  echo ">>> Creating database backup on $HOST ..."

  $SSH_CMD "docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME | gzip > $APP_DIR/backups/$BACKUP_FILE"
  echo ">>> Backup created: $APP_DIR/backups/$BACKUP_FILE"

  if [ -n "$S3_DEST" ]; then
    # Download locally then upload to S3
    scp -i "$SSH_KEY" "$SSH_USER@$HOST:$APP_DIR/backups/$BACKUP_FILE" "/tmp/$BACKUP_FILE"
    aws s3 cp "/tmp/$BACKUP_FILE" "${S3_DEST}${BACKUP_FILE}"
    rm -f "/tmp/$BACKUP_FILE"
    echo ">>> Uploaded to $S3_DEST$BACKUP_FILE"
  fi
else
  # Local backup (running on the VM itself)
  echo ">>> Creating local database backup..."
  docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME | gzip > "$APP_DIR/backups/$BACKUP_FILE"
  echo ">>> Backup created: $APP_DIR/backups/$BACKUP_FILE"

  if [ -n "$S3_DEST" ]; then
    aws s3 cp "$APP_DIR/backups/$BACKUP_FILE" "${S3_DEST}${BACKUP_FILE}"
    echo ">>> Uploaded to $S3_DEST$BACKUP_FILE"
  fi
fi

# Cleanup old local backups (keep 7 days)
if [ -n "$HOST" ]; then
  $SSH_CMD "find $APP_DIR/backups -name 'sparknode-backup-*.sql.gz' -mtime +7 -delete 2>/dev/null || true"
else
  find "$APP_DIR/backups" -name 'sparknode-backup-*.sql.gz' -mtime +7 -delete 2>/dev/null || true
fi

echo ">>> Backup complete: $BACKUP_FILE"
