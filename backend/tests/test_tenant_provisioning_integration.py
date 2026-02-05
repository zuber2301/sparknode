"""
Simple integration tests for tenant provisioning
Uses live API endpoints for testing (no in-memory DB)

Run these tests against a running SparkNode backend instance
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:7100/api"


def test_create_tenant_basic():
    """Test basic tenant creation via API"""
    # First login as platform admin
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": "super_user@sparknode.io",
            "password": "jspark123"
        }
    )
    
    if login_response.status_code != 200:
        print("❌ Failed to login as platform admin")
        print(f"Response: {login_response.json()}")
        return False
    
    admin_token = login_response.json()["access_token"]
    
    # Create a new tenant
    tenant_data = {
        "name": "Test Tenant 2026",
        "slug": "test-2026",
        "domain": "test2026.sparknode.io",
        "admin_email": "admin@test2026.io",
        "admin_first_name": "Test",
        "admin_last_name": "Admin",
        "admin_password": "TestPass123!",
        "subscription_tier": "professional",
        "max_users": 100,
        "master_budget_balance": 50000
    }
    
    response = requests.post(
        f"{BASE_URL}/platform/tenants",
        json=tenant_data,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        tenant = response.json()
        print("✅ Tenant created successfully")
        print(f"   Tenant ID: {tenant['id']}")
        print(f"   Name: {tenant['name']}")
        print(f"   Domain: {tenant['domain']}")
        print(f"   Status: {tenant['status']}")
        print(f"   User Count: {tenant['user_count']}")
        return True
    else:
        print(f"❌ Failed to create tenant: {response.status_code}")
        print(f"   Response: {response.json()}")
        return False


def test_admin_can_login():
    """Test that created admin user can login"""
    # Login as newly created admin
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": "admin@test2026.io",
            "password": "TestPass123!"
        }
    )
    
    if login_response.status_code == 200:
        token = login_response.json()["access_token"]
        print("✅ Newly created admin can login")
        print(f"   Token: {token[:20]}...")
        return True
    else:
        print(f"❌ Admin login failed: {login_response.status_code}")
        print(f"   Response: {login_response.json()}")
        return False


def test_invite_users_endpoint():
    """Test invite users endpoint (Invite-Link Method)"""
    # Login as tenant admin
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": "tenant_manager@sparknode.io",
            "password": "jspark123"
        }
    )
    
    if login_response.status_code != 200:
        print("❌ Failed to login as tenant admin")
        return False
    
    token = login_response.json()["access_token"]
    
    # Generate invitation links
    invite_data = {
        "email": "newtenant@example.com",
        "expires_hours": 24
    }
    
    response = requests.post(
        f"{BASE_URL}/auth/invitations/generate",
        json=invite_data,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        result = response.json()
        print("✅ Invitation link generated")
        print(f"   Token: {result['token'][:20]}...")
        print(f"   Join URL: {result['join_url'][:50]}...")
        print(f"   Expires: {result['expires_at']}")
        return True
    else:
        print(f"❌ Failed to generate invitation: {response.status_code}")
        print(f"   Response: {response.json()}")
        return False


def test_bulk_upload_endpoint():
    """Test bulk upload endpoint"""
    # Login as HR admin
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": "tenant_manager@sparknode.io",
            "password": "jspark123"
        }
    )
    
    if login_response.status_code != 200:
        print("❌ Failed to login as HR admin")
        return False
    
    token = login_response.json()["access_token"]
    
    # Create test CSV
    csv_content = """email,full_name,department,role
alice@test.com,Alice Johnson,Engineering,corporate_user
bob@test.com,Bob Smith,Engineering,dept_lead
carol@test.com,Carol Davis,Marketing,corporate_user"""
    
    files = {
        'file': ('test_users.csv', csv_content, 'text/csv')
    }
    
    response = requests.post(
        f"{BASE_URL}/users/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        result = response.json()
        print("✅ Bulk upload processed")
        print(f"   Batch ID: {result['batch_id']}")
        print(f"   Total rows: {result['total_rows']}")
        print(f"   Valid rows: {result['valid_rows']}")
        print(f"   Error rows: {result['error_rows']}")
        return True
    else:
        print(f"❌ Bulk upload failed: {response.status_code}")
        print(f"   Response: {response.json()}")
        return False


def run_all_tests():
    """Run all tests"""
    print("\n" + "="*70)
    print("TENANT PROVISIONING TEST SUITE")
    print("="*70 + "\n")
    
    tests = [
        ("Basic Tenant Creation", test_create_tenant_basic),
        ("Admin User Login", test_admin_can_login),
        ("Invite Users (Invite-Link Method)", test_invite_users_endpoint),
        ("Bulk Upload (CSV Import)", test_bulk_upload_endpoint),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n[TEST] {test_name}")
        print("-" * 70)
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
            results.append((test_name, False))
    
    # Print summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print("="*70 + "\n")
    
    return passed == total


if __name__ == "__main__":
    import sys
    success = run_all_tests()
    sys.exit(0 if success else 1)
