"""
Integration tests that run against the actual running PostgreSQL database.
These tests verify the API endpoints work correctly end-to-end.
"""
import pytest
import requests
import os

# Use environment variable or default to new port
BASE_URL = os.getenv("API_URL", "http://localhost:6100")


class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health_endpoint_returns_healthy(self):
        """Test that health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_with_valid_credentials(self):
        """Test login returns token with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@demo.com", "password": "password123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "admin@demo.com"
        assert data["user"]["role"] == "tenant_tenant_tenant_manager"
    
    def test_login_with_invalid_password(self):
        """Test login fails with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@demo.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
    
    def test_login_with_nonexistent_email(self):
        """Test login fails with non-existent email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@demo.com", "password": "password123"}
        )
        assert response.status_code == 401
    
    def test_protected_route_without_token(self):
        """Test that protected routes require authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
    
    def test_me_endpoint_with_valid_token(self):
        """Test /me endpoint returns current user"""
        # Login first
        login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@demo.com", "password": "password123"}
        )
        token = login.json()["access_token"]
        
        # Access protected route
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["email"] == "admin@demo.com"


def get_auth_header(email="admin@demo.com"):
    """Helper to get auth header"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": "password123"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestUsers:
    """Test user management endpoints"""
    
    def test_list_users(self):
        """Test listing all users"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5  # We have 5 demo users
    
    def test_get_user_by_id(self):
        """Test getting a specific user by ID"""
        # First get list to find a user ID
        users = requests.get(
            f"{BASE_URL}/api/users",
            headers=get_auth_header()
        ).json()
        
        user_id = users[0]["id"]
        response = requests.get(
            f"{BASE_URL}/api/users/{user_id}",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        assert response.json()["id"] == user_id


class TestWallets:
    """Test wallet endpoints"""
    
    def test_get_my_wallet(self):
        """Test getting current user's wallet"""
        response = requests.get(
            f"{BASE_URL}/api/wallets/me",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data
        assert "lifetime_earned" in data
        assert "lifetime_spent" in data
    
    def test_get_my_ledger(self):
        """Test getting wallet transaction history"""
        response = requests.get(
            f"{BASE_URL}/api/wallets/me/ledger",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestRecognition:
    """Test recognition endpoints"""
    
    def test_get_badges(self):
        """Test getting available badges"""
        response = requests.get(
            f"{BASE_URL}/api/recognitions/badges",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 8  # We have 8 system badges
        
        # Verify badge structure
        badge = data[0]
        assert "id" in badge
        assert "name" in badge
        assert "description" in badge
        assert "points_value" in badge
    
    def test_list_recognitions(self):
        """Test listing all recognitions"""
        response = requests.get(
            f"{BASE_URL}/api/recognitions",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestFeed:
    """Test social feed endpoints"""
    
    def test_get_feed(self):
        """Test getting the social feed"""
        response = requests.get(
            f"{BASE_URL}/api/feed",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestNotifications:
    """Test notification endpoints"""
    
    def test_get_notifications(self):
        """Test getting user notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_notification_count(self):
        """Test getting unread notification count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/count",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data or "count" in data
        assert "unread" in data or "count" in data


class TestBudgets:
    """Test budget management endpoints"""
    
    def test_list_budgets(self):
        """Test listing budgets"""
        response = requests.get(
            f"{BASE_URL}/api/budgets",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # We have at least 1 demo budget


class TestRedemption:
    """Test redemption/voucher endpoints"""
    
    def test_get_vouchers(self):
        """Test getting available vouchers"""
        response = requests.get(
            f"{BASE_URL}/api/redemptions/vouchers",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_my_redemptions(self):
        """Test getting redemption history"""
        response = requests.get(
            f"{BASE_URL}/api/redemptions",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestAudit:
    """Test audit log endpoints"""
    
    def test_get_audit_logs_as_tenant_tenant_tenant_manager(self):
        """Test getting audit logs (HR admin access)"""
        response = requests.get(
            f"{BASE_URL}/api/audit",
            headers=get_auth_header("admin@demo.com")  # HR admin
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestTenants:
    """Test tenant endpoints"""
    
    def test_get_current_tenant(self):
        """Test getting current tenant info"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/current",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert data["name"] == "Demo Company"
    
    def test_get_departments(self):
        """Test getting tenant departments"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/departments",
            headers=get_auth_header()
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5  # We have 5 departments


class TestRoleBasedAccess:
    """Test role-based access control"""
    
    def test_employee_cannot_access_audit(self):
        """Test that employees cannot access audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/audit",
            headers=get_auth_header("employee@demo.com")
        )
        # Should be 403 Forbidden
        assert response.status_code == 403
    
    def test_employee_can_access_own_wallet(self):
        """Test that employees can access their own wallet"""
        response = requests.get(
            f"{BASE_URL}/api/wallets/me",
            headers=get_auth_header("employee@demo.com")
        )
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
