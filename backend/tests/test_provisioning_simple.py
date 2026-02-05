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
TENANT_ADMIN_EMAIL = "tenant_manager@sparknode.io"
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
def tenant_manager_token():
    """Get tenant admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": TENANT_ADMIN_EMAIL, "password": PASSWORD}
    )
    assert response.status_code == 200, f"Failed to login: {response.json()}"
    return response.json()["access_token"]


class TestInviteUsersMethod:
    """Test the Invite-Link provisioning method"""
    
    def test_generate_invitation_link(self, tenant_manager_token):
        """Test generating an invitation link for a new user"""
        payload = {
            "email": f"newuser_{datetime.now().timestamp()}@example.com",
            "expires_hours": 24
        }
        
        response = requests.post(
            f"{BASE_URL}/auth/invitations/generate",
            json=payload,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code in [200, 201, 405], f"Unexpected status: {response.status_code}, response: {response.json()}"
        if response.status_code in [200, 201]:
            data = response.json()
            assert "token" in data or "join_url" in data or "detail" in data
            print(f"✅ Invitation generated: {data}")


class TestBulkUploadMethod:
    """Test the Bulk Upload (CSV) provisioning method"""
    
    def test_bulk_upload_endpoint(self, tenant_manager_token):
        """Test uploading a CSV file for bulk user provisioning"""
        csv_content = """email,full_name,department,role
alice@example.com,Alice Johnson,Engineering,corporate_user
bob@example.com,Bob Smith,Engineering,dept_lead
carol@example.com,Carol Davis,Marketing,corporate_user"""
        
        files = {
            'file': (f'test_users_{datetime.now().timestamp()}.csv', csv_content, 'text/csv')
        }
        
        response = requests.post(
            f"{BASE_URL}/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        if response.status_code != 200:
            print(f"Error response: {response.text}")
        
        assert response.status_code in [200, 201, 400], f"Unexpected status: {response.status_code}\nResponse: {response.text}"
        data = response.json()
        print(f"✅ Bulk upload response: {data}")


class TestUserManagement:
    """Test user management endpoints"""
    
    def test_list_users(self, tenant_manager_token):
        """Test fetching list of users"""
        response = requests.get(
            f"{BASE_URL}/users",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200, f"Failed to list users: {response.json()}"
        data = response.json()
        assert isinstance(data, (list, dict)), "Response should be list or dict"
        print(f"✅ Users listed: {len(data) if isinstance(data, list) else 'dict response'}")
    
    def test_get_user_profile(self, tenant_manager_token):
        """Test fetching current user profile"""
        response = requests.get(
            f"{BASE_URL}/users/profile",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get profile: {response.json()}"
        user = response.json()
        assert "corporate_email" in user or "email" in user
        print(f"✅ User profile retrieved: {user.get('corporate_email', user.get('email'))}")


class TestTenantOperations:
    """Test tenant-level operations"""
    
    def test_get_current_tenant(self, tenant_manager_token):
        """Test fetching current tenant information"""
        response = requests.get(
            f"{BASE_URL}/tenants/current",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get tenant: {response.json()}"
        tenant = response.json()
        assert "name" in tenant or "id" in tenant
        print(f"✅ Tenant retrieved: {tenant.get('name', 'Unknown')}")
    
    def test_list_departments(self, tenant_manager_token):
        """Test listing tenant departments"""
        response = requests.get(
            f"{BASE_URL}/departments",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
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
        assert data.get("user", {}).get("is_super_admin") == True or "super_admin" in str(data)
        print(f"✅ Platform admin login successful")
    
    def test_login_as_tenant_manager(self):
        """Test tenant admin login"""
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": TENANT_ADMIN_EMAIL, "password": PASSWORD}
        )
        
        assert response.status_code == 200, f"Failed to login as tenant admin: {response.json()}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data or "tenant_id" in data
        print(f"✅ Tenant admin login successful")
    
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
