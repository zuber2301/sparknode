#!/bin/bash
set -e

# SparkNode - WAL-G Backup and Restore Wrapper
# This script runs inside the Postgres container or on the host VM
# It manages WAL-G backups to S3

WALG_IMAGE="wal-g/wal-g:latest" 

backup_push() {
    echo ">>> Starting full WAL-G backup..."
    wal-g backup-push /var/lib/postgresql/data
    echo ">>> Backup completed successfully."
}

backup_list() {
    wal-g backup-list
}

delete_old() {
    echo ">>> Cleaning up old backups (keeping 14 days)..."
    wal-g delete before now-14d --confirm
}

case "$1" in
    push) backup_push ;;
    list) backup_list ;;
    delete) delete_old ;;
    *) echo "Usage: $0 {push|list|delete}"; exit 1 ;;
esac
