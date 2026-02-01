#!/bin/bash

# DEPLOYMENT_STEPS.sh - Copy-paste ready deployment commands
# Run each section in order, waiting for success before moving to next

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
WORKSPACE="/root/repos_products/sparknode"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  TENANT-USER MAPPING DEPLOYMENT - STEP-BY-STEP GUIDE       ║"
echo "║  Timestamp: $TIMESTAMP                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# STEP 1: DATABASE BACKUP
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: DATABASE BACKUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Creating PostgreSQL backup before migration..."
echo ""

read -p "Press Enter to create database backup (this cannot be undone): " -r

# Create backup directory if it doesn't exist
mkdir -p "$WORKSPACE/backups"

BACKUP_FILE="$WORKSPACE/backups/sparknode_backup_$TIMESTAMP.sql"

echo "📦 Creating backup: $BACKUP_FILE"
pg_dump -U sparknode -d sparknode > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Backup created successfully: $BACKUP_SIZE"
echo ""

# ============================================================================
# STEP 2: DATABASE MIGRATION
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: RUN DATABASE MIGRATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "This will:"
echo "  • Create invitation_tokens table"
echo "  • Validate all users have tenant_id (NOT NULL)"
echo "  • Check data integrity and constraints"
echo ""

read -p "Press Enter to run database migration: " -r

cd "$WORKSPACE/backend"
echo "🔄 Running migration script..."
python3 migrate_tenant_user_mapping.py

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully"
else
    echo "❌ Database migration failed!"
    echo "⚠️  Restore from backup: psql -U sparknode < $BACKUP_FILE"
    exit 1
fi
echo ""

# ============================================================================
# STEP 3: BACKEND DEPENDENCIES
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: UPDATE BACKEND DEPENDENCIES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Installing Python packages (may take 1-2 minutes)..."
echo ""

cd "$WORKSPACE/backend"
pip install -q -r requirements.txt --break-system-packages 2>/dev/null

echo "✅ Dependencies installed"
echo ""

# ============================================================================
# STEP 4: SYNTAX VALIDATION
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4: VERIFY PYTHON SYNTAX"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Checking Python files for syntax errors..."
echo ""

cd "$WORKSPACE/backend"
python3 -m py_compile auth/onboarding.py auth/routes.py models.py migrate_tenant_user_mapping.py users/routes.py

echo "✅ All Python files compile successfully"
echo ""

# ============================================================================
# STEP 5: DISPLAY DEPLOYMENT COMMANDS
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PRE-DEPLOYMENT VALIDATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Database: ✅ Backed up to $BACKUP_FILE"
echo "Migration: ✅ Successfully executed"
echo "Python: ✅ All files valid"
echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "NEXT STEPS - DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🟢 OPTION A: Run Backend in Development Mode"
echo "────────────────────────────────────────────────"
echo "cd $WORKSPACE/backend"
echo "uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "🟢 OPTION B: Run Backend in Production Mode"
echo "──────────────────────────────────────────────"
echo "cd $WORKSPACE/backend"
echo "gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000"
echo ""
echo "🟢 OPTION C: Deploy with Docker Compose"
echo "────────────────────────────────────────"
echo "cd $WORKSPACE"
echo "docker-compose -f docker-compose.yml up -d"
echo ""
echo "🟢 TEST SIGNUP FLOWS"
echo "───────────────────"
echo "1. Visit: http://localhost/signup"
echo "2. Test domain-match: email@companydom.com"
echo "3. Test invite-link: http://localhost/signup?token=ABC"
echo ""
echo "🟢 VERIFY JWT INCLUDES TENANT_ID"
echo "────────────────────────────────"
echo "Browser Console: localStorage.getItem('token')"
echo "Decode at: https://jwt.io"
echo "Should contain: \"tenant_id\": \"<UUID>\""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Full documentation:"
echo "   - DEPLOYMENT_IMMEDIATE_STEPS.md (this file)"
echo "   - DEPLOYMENT_CHECKLIST_TENANT_MAPPING.md"
echo "   - TENANT_USER_MAPPING_QUICK_REFERENCE.md"
echo ""
echo "✅ System ready for deployment!"
echo ""
