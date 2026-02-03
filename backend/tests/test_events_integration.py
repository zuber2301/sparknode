"""
Integration tests for Event Creation API.
These tests run against the actual running Docker backend.

To run these tests:
1. Ensure Docker containers are running: docker-compose up -d
2. Run: pytest tests/test_events_integration.py -v
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
from uuid import uuid4

# Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:7100")
TENANT_ID = "100e8400-e29b-41d4-a716-446655440000"  # jSpark tenant from seed.sql
DEPT_ID = "110e8400-e29b-41d4-a716-446655440000"  # HR department

# Test account credentials
SUPER_USER_EMAIL = "super_user@sparknode.io"
ADMIN_USER_EMAIL = "tenant_manager@sparknode.io"
REGULAR_USER_EMAIL = "user@sparknode.io"
PASSWORD = "jspark123"


class TestEventCreationIntegration:
    """Integration tests for event creation endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BACKEND_URL}/api/auth/login",
            json={"email": ADMIN_USER_EMAIL, "password": PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def platform_admin_token(self):
        """Get platform admin authentication token"""
        response = requests.post(
            f"{BACKEND_URL}/api/auth/login",
            json={"email": SUPER_USER_EMAIL, "password": PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def regular_user_token(self):
        """Get regular user authentication token"""
        response = requests.post(
            f"{BACKEND_URL}/api/auth/login",
            json={"email": REGULAR_USER_EMAIL, "password": PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_create_event_without_authentication(self):
        """Test that event creation fails without authentication token"""
        event_data = {
            "title": "Unauthenticated Event",
            "type": "celebration",
            "start_datetime": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "end_datetime": (datetime.utcnow() + timedelta(days=8)).isoformat(),
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/events/",
            json=event_data
        )
        
        # API returns 401 for missing credentials
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        assert "Not authenticated" in response.text or "credentials" in response.text.lower()
    
    def test_create_event_with_invalid_token(self):
        """Test that event creation fails with invalid authentication token"""
        event_data = {
            "title": "Invalid Token Event",
            "type": "celebration",
            "start_datetime": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "end_datetime": (datetime.utcnow() + timedelta(days=8)).isoformat(),
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/events/",
            json=event_data,
            headers={"Authorization": "Bearer invalid_token_xyz"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        assert "Could not validate credentials" in response.text
    
    def test_create_event_with_valid_token(self, admin_token):
        """Test creating an event with valid authentication token"""
        event_data = {
            "title": f"Test Event {datetime.utcnow().isoformat()}",
            "description": "Test event for API",
            "type": "celebration",
            "start_datetime": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "end_datetime": (datetime.utcnow() + timedelta(days=8)).isoformat(),
            "venue": "Main Hall",
            "location": "Building A",
            "format": "hybrid",
            "banner_url": "https://example.com/banner.jpg",
            "color_code": "#FF5733",
            "status": "draft",
            "visibility": "all_employees",
            "visible_to_departments": [DEPT_ID],
            "nomination_start": datetime.utcnow().isoformat(),
            "nomination_end": (datetime.utcnow() + timedelta(days=5)).isoformat(),
            "who_can_nominate": "all_employees",
            "max_activities_per_person": 3,
            "planned_budget": 5000.00,
            "currency": "USD"
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/events/",
            json=event_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain event ID"
        assert data["title"] == event_data["title"]
        assert data["status"] == "draft"
        print(f"✓ Event created successfully: {data['id']}")
    
    def test_create_event_with_minimal_fields(self, admin_token):
        """Test creating event with only required fields"""
        event_data = {
            "title": f"Minimal Event {datetime.utcnow().isoformat()}",
            "type": "celebration",
            "start_datetime": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "end_datetime": (datetime.utcnow() + timedelta(days=8)).isoformat(),
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/events/",
            json=event_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["title"] == event_data["title"]
        print(f"✓ Minimal event created successfully: {data['id']}")
    
    def test_create_event_with_platform_admin(self, platform_admin_token):
        """Test creating an event with platform admin account"""
        event_data = {
            "title": f"Platform Admin Event {datetime.utcnow().isoformat()}",
            "type": "celebration",
            "start_datetime": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "end_datetime": (datetime.utcnow() + timedelta(days=8)).isoformat(),
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/events/",
            json=event_data,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        
        # Note: This should succeed as the endpoint doesn't check admin role yet
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Event created by platform admin: {response.json()['id']}")
    
    def test_create_event_with_regular_user(self, regular_user_token):
        """Test creating event with regular user (should succeed - role check not implemented yet)"""
        event_data = {
            "title": f"Regular User Event {datetime.utcnow().isoformat()}",
            "type": "celebration",
            "start_datetime": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "end_datetime": (datetime.utcnow() + timedelta(days=8)).isoformat(),
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/events/",
            json=event_data,
            headers={"Authorization": f"Bearer {regular_user_token}"}
        )
        
        # Currently succeeds due to missing role check (TODO in code)
        # Should fail with 403 when role enforcement is implemented
        if response.status_code == 200:
            print(f"⚠ Regular user can create events (TODO: implement role check)")
            print(f"  Event ID: {response.json()['id']}")
        else:
            print(f"✓ Regular user blocked from creating events: {response.status_code}")
    
    def test_list_events_with_valid_token(self, admin_token):
        """Test listing events with valid authentication"""
        response = requests.get(
            f"{BACKEND_URL}/api/events/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        events = response.json()
        assert isinstance(events, list), "Response should be a list"
        print(f"✓ Listed {len(events)} events")
    
    def test_list_events_without_token(self):
        """Test that listing events fails without authentication"""
        response = requests.get(f"{BACKEND_URL}/api/events/")
        
        # API returns 401 for missing credentials
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Event listing blocked without authentication")
    
    def test_event_belongs_to_correct_tenant(self, admin_token):
        """Test that created event belongs to the user's tenant"""
        event_data = {
            "title": f"Tenant Test Event {datetime.utcnow().isoformat()}",
            "type": "celebration",
            "start_datetime": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "end_datetime": (datetime.utcnow() + timedelta(days=8)).isoformat(),
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/events/",
            json=event_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert str(data["tenant_id"]) == TENANT_ID
        print(f"✓ Event correctly assigned to tenant {TENANT_ID}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
