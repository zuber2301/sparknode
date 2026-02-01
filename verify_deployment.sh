#!/bin/bash

# Tenant-User Mapping Deployment Verification Script
# Checks all components are ready for deployment

set -e

echo "=========================================="
echo "TENANT-USER MAPPING DEPLOYMENT VERIFICATION"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_FAILED=0

check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $description - FILE NOT FOUND: $file"
        ((CHECKS_FAILED++))
    fi
}

check_code() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $description - PATTERN NOT FOUND in $file"
        ((CHECKS_FAILED++))
    fi
}

echo "1. BACKEND FILES"
echo "================"
check_file "backend/auth/onboarding.py" "Onboarding module exists"
check_file "backend/migrate_tenant_user_mapping.py" "Migration script exists"
check_file "backend/auth/routes.py" "Auth routes file exists"
check_file "backend/models.py" "Models file exists"
echo ""

echo "2. FRONTEND FILES"
echo "================="
check_file "frontend/src/pages/Signup.jsx" "Signup page component exists"
check_file "frontend/src/lib/api.js" "API client file exists"
check_file "frontend/src/App.jsx" "App routing file exists"
check_file "frontend/dist/index.html" "Frontend build exists"
echo ""

echo "3. DOCUMENTATION FILES"
echo "======================"
check_file "TENANT_USER_MAPPING_GUIDE.md" "Comprehensive guide exists"
check_file "TENANT_USER_MAPPING_QUICK_REFERENCE.md" "Quick reference exists"
check_file "TENANT_USER_MAPPING_IMPLEMENTATION_SUMMARY.md" "Implementation summary exists"
check_file "DEPLOYMENT_CHECKLIST_TENANT_MAPPING.md" "Deployment checklist exists"
echo ""

echo "4. CODE IMPLEMENTATION CHECKS"
echo "============================="
check_code "backend/auth/onboarding.py" "def resolve_tenant(" "resolve_tenant() function exists"
check_code "backend/auth/onboarding.py" "def generate_invitation_token(" "generate_invitation_token() function exists"
check_code "backend/auth/routes.py" "def signup(" "signup endpoint implemented"
check_code "backend/auth/routes.py" "def generate_invitation_link(" "invitation link endpoint implemented"
check_code "backend/models.py" "class InvitationToken" "InvitationToken model exists"
check_code "backend/users/routes.py" "def get_tenant_users(" "Platform admin endpoint exists"
check_code "frontend/src/pages/Signup.jsx" "export default function Signup" "Signup component exported"
check_code "frontend/src/lib/api.js" "signup:" "signup API method exists"
echo ""

echo "5. PYTHON SYNTAX CHECK"
echo "======================"
if python3 -m py_compile backend/auth/onboarding.py backend/auth/routes.py backend/models.py backend/migrate_tenant_user_mapping.py 2>/dev/null; then
    echo -e "${GREEN}✓${NC} All Python files compile successfully"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}✗${NC} Python syntax errors found"
    ((CHECKS_FAILED++))
fi
echo ""

echo "6. DATABASE FILES"
echo "================"
check_file "database/init.sql" "Database schema file exists"
check_code "database/init.sql" "CREATE TABLE users" "Users table defined"
check_code "database/init.sql" "CREATE TABLE invitation_tokens" "Invitation tokens table defined"
check_code "database/init.sql" "tenant_id UUID NOT NULL" "Tenant_id constraint present"
echo ""

echo "=========================================="
echo "VERIFICATION SUMMARY"
echo "=========================================="
echo -e "Checks Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Checks Failed: ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CHECKS PASSED - READY FOR DEPLOYMENT${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run database migration:"
    echo "   cd backend && python3 migrate_tenant_user_mapping.py"
    echo ""
    echo "2. Start backend:"
    echo "   cd backend && uvicorn main:app --reload"
    echo ""
    echo "3. Deploy frontend:"
    echo "   Upload frontend/dist/ to web server"
    echo ""
    echo "4. Test signup flows (see DEPLOYMENT_CHECKLIST_TENANT_MAPPING.md)"
    exit 0
else
    echo -e "${RED}✗ VERIFICATION FAILED - FIX ISSUES BEFORE DEPLOYMENT${NC}"
    exit 1
fi
