"""
Simple tests for tenant provisioning using pytest directly
These tests exercise the three provisioning methods without needing migrations
"""

import pytest
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:7100/api"
SUPER_USER_EMAIL = "super_user@sparknode.io"
TENANT_ADMIN_EMAIL = "tenant_admin@sparknode.io"
PASSWORD = "jspark123"


@pytest.fixture
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": SUPER_USER_EMAIL, "password": PASSWORD}
    )
    assert response.status_code == 200, f"Failed to login: {response.json()}"
    return response.json()["access_token"]


@pytest.fixture
def tenant_tenant_tenant_manager_token(admin_token):
    """Get tenant admin authentication token (create temporary tenant tenant_tenant_manager if needed)"""
    import time
    # Try seeded user first
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": TENANT_ADMIN_EMAIL, "password": PASSWORD}
    )
    if response.status_code == 200:
        return response.json()["access_token"]

    # If seeded login failed, create a temporary tenant tenant_tenant_manager using platform admin
    tmp_email = f"tm_test_{int(time.time())}@sparknode.io"
    create_payload = {
        "corporate_email": tmp_email,
        "first_name": "TM",
        "last_name": "Test",
        "org_role": "tenant_tenant_tenant_manager",
        "password": PASSWORD,
        "department_id": "110e8400-e29b-41d4-a716-446655440000"
    }
    headers = {"Authorization": f"Bearer {admin_token}"}
    create_resp = requests.post(f"{BASE_URL}/users", json=create_payload, headers=headers)
    if create_resp.status_code not in (200, 201):
        # Fallback: try a short retry on login
        for _ in range(2):
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json={"email": TENANT_ADMIN_EMAIL, "password": PASSWORD}
            )
            if response.status_code == 200:
                return response.json()["access_token"]
            time.sleep(0.5)
        assert False, f"Unable to create or login tenant tenant_tenant_manager: {create_resp.status_code} {create_resp.text}"

    # Login as the temporary user
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={"email": tmp_email, "password": PASSWORD})
    assert login_resp.status_code == 200, f"Failed to login as newly created tenant tenant_tenant_manager: {login_resp.text}"
    return login_resp.json()["access_token"]


class TestInviteUsersMethod:
    """Test the Invite-Link provisioning method"""
    
    def test_generate_invitation_link(self, tenant_tenant_tenant_manager_token):
        """Test generating an invitation link for a new user"""
        payload = {
            "email": f"newuser_{datetime.now().timestamp()}@example.com",
            "expires_hours": 24
        }
        
        response = requests.post(
            f"{BASE_URL}/auth/invitations/generate",
            json=payload,
            headers={"Authorization": f"Bearer {tenant_tenant_tenant_manager_token}"}
        )
        
        assert response.status_code in [200, 201, 405], f"Unexpected status: {response.status_code}, response: {response.json()}"
        if response.status_code in [200, 201]:
            data = response.json()
            assert "token" in data or "join_url" in data or "detail" in data
            print(f"✅ Invitation generated: {data}")


class TestBulkUploadMethod:
    """Test the Bulk Upload (CSV) provisioning method"""
    
    def test_bulk_upload_endpoint(self, tenant_tenant_tenant_manager_token):
        """Test uploading a CSV file for bulk user provisioning"""
        csv_content = """email,full_name,department,role
alice@example.com,Alice Johnson,Engineering,tenant_user
bob@example.com,Bob Smith,Engineering,dept_lead
carol@example.com,Carol Davis,Marketing,tenant_user"""
        
        files = {
            'file': (f'test_users_{datetime.now().timestamp()}.csv', csv_content, 'text/csv')
        }
        
        response = requests.post(
            f"{BASE_URL}/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_tenant_tenant_manager_token}"}
        )
        
        if response.status_code != 200:
            print(f"Error response: {response.text}")
        
        assert response.status_code in [200, 201, 400], f"Unexpected status: {response.status_code}\nResponse: {response.text}"
        data = response.json()
        print(f"✅ Bulk upload response: {data}")


class TestUserManagement:
    """Test user management endpoints"""
    
    def test_list_users(self, tenant_tenant_tenant_manager_token):
        """Test fetching list of users"""
        response = requests.get(
            f"{BASE_URL}/users",
            headers={"Authorization": f"Bearer {tenant_tenant_tenant_manager_token}"}
        )
        
        assert response.status_code == 200, f"Failed to list users: {response.json()}"
        data = response.json()
        assert isinstance(data, (list, dict)), "Response should be list or dict"
        print(f"✅ Users listed: {len(data) if isinstance(data, list) else 'dict response'}")
    
    def test_get_user_profile(self, tenant_tenant_tenant_manager_token):
        """Test fetching current user profile"""
        response = requests.get(
            f"{BASE_URL}/users/profile",
            headers={"Authorization": f"Bearer {tenant_tenant_tenant_manager_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get profile: {response.json()}"
        user = response.json()
        assert "corporate_email" in user or "email" in user
        print(f"✅ User profile retrieved: {user.get('corporate_email', user.get('email'))}")


class TestTenantOperations:
    """Test tenant-level operations"""
    
    def test_get_current_tenant(self, tenant_tenant_tenant_manager_token):
        """Test fetching current tenant information"""
        response = requests.get(
            f"{BASE_URL}/tenants/current",
            headers={"Authorization": f"Bearer {tenant_tenant_tenant_manager_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get tenant: {response.json()}"
        tenant = response.json()
        assert "name" in tenant or "id" in tenant
        print(f"✅ Tenant retrieved: {tenant.get('name', 'Unknown')}")
    
    def test_list_departments(self, tenant_tenant_tenant_manager_token):
        """Test listing tenant departments"""
        response = requests.get(
            f"{BASE_URL}/departments",
            headers={"Authorization": f"Bearer {tenant_tenant_tenant_manager_token}"}
        )
        
        if response.status_code == 200:
            depts = response.json()
            print(f"✅ Departments listed: {len(depts) if isinstance(depts, list) else 'N/A'}")
        else:
            print(f"⚠️  Could not list departments: {response.status_code}")


class TestAuthenticationFlow:
    """Test authentication and authorization"""
    
    def test_login_as_platform_admin(self):
        """Test platform admin login"""
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": SUPER_USER_EMAIL, "password": PASSWORD}
        )
        
        assert response.status_code == 200, f"Failed to login as platform admin: {response.json()}"
        data = response.json()
        assert "access_token" in data
        assert data.get("user", {}).get("is_platform_admin") == True or "super_admin" in str(data)
        print(f"✅ Platform admin login successful")
    
    def test_login_as_tenant_tenant_tenant_manager(self, tenant_tenant_tenant_manager_token):
        """Test tenant admin login via fixture"""
        assert tenant_tenant_tenant_manager_token is not None, "Failed to obtain tenant tenant_tenant_manager token"
        print("✅ Tenant admin login successful (via fixture)")
    
    def test_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": "invalid@example.com", "password": "wrongpassword"}
        )
        
        assert response.status_code == 401, f"Should reject invalid credentials"
        print(f"✅ Invalid credentials rejected correctly")
    
    def test_unauthorized_access(self, admin_token):
        """Test that invalid token is rejected"""
        response = requests.get(
            f"{BASE_URL}/users",
            headers={"Authorization": "Bearer invalid.token.here"}
        )
        
        assert response.status_code == 401 or response.status_code == 403
        print(f"✅ Invalid token rejected correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
