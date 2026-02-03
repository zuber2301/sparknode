"""
Integration Tests for Events API
Comprehensive tests for event management endpoints with real database interactions
"""
import pytest
from fastapi.testclient import TestClient
from uuid import uuid4
from models import Event, User, Tenant
from datetime import datetime


class TestEventsApiIntegration:
    """Integration tests for /events/* endpoints"""
    
    def test_list_events_by_tenant(self, client, tenant_manager_token, db_session, tenant):
        """Test listing events returns only current tenant's events"""
        response = client.get(
            "/events",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        events = response.json()
        
        # Verify all events belong to current tenant
        for event in events:
            db_event = db_session.query(Event).filter_by(id=event.get('id')).first()
            assert db_event is None or db_event.tenant_id == tenant.id
    
    def test_create_event_success(self, client, tenant_manager_token, tenant):
        """Test creating a new event"""
        event_data = {
            "title": "Team Meeting",
            "description": "Weekly sync",
            "event_type": "meeting",
            "date": "2026-02-15T10:00:00",
            "location": "Conference Room A"
        }
        
        response = client.post(
            "/events",
            json=event_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code in [200, 201]
        created_event = response.json()
        assert created_event['title'] == event_data['title']
    
    def test_get_event_by_id(self, client, tenant_manager_token, db_session, tenant):
        """Test retrieving a specific event"""
        # Create event
        event = Event(
            tenant_id=tenant.id,
            title="Test Event",
            description="Test",
            event_type="meeting",
            date=datetime.now()
        )
        db_session.add(event)
        db_session.commit()
        
        response = client.get(
            f"/events/{event.id}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        retrieved_event = response.json()
        assert retrieved_event['title'] == "Test Event"
    
    def test_update_event(self, client, tenant_manager_token, db_session, tenant):
        """Test updating an event"""
        event = Event(
            tenant_id=tenant.id,
            title="Original Title",
            description="Test",
            event_type="meeting",
            date=datetime.now()
        )
        db_session.add(event)
        db_session.commit()
        
        update_data = {"title": "Updated Title"}
        response = client.patch(
            f"/events/{event.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        updated_event = response.json()
        assert updated_event['title'] == "Updated Title"
    
    def test_delete_event(self, client, tenant_manager_token, db_session, tenant):
        """Test deleting an event"""
        event = Event(
            tenant_id=tenant.id,
            title="To Delete",
            description="Test",
            event_type="meeting",
            date=datetime.now()
        )
        db_session.add(event)
        db_session.commit()
        event_id = event.id
        
        response = client.delete(
            f"/events/{event_id}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        
        # Verify deleted
        deleted_event = db_session.query(Event).filter_by(id=event_id).first()
        assert deleted_event is None or deleted_event.status == "DELETED"
    
    def test_event_cross_tenant_forbidden(self, client, tenant_manager_token, other_tenant, db_session):
        """Test accessing event from different tenant returns 403"""
        # Create event in other tenant
        event = Event(
            tenant_id=other_tenant.id,
            title="Other Tenant Event",
            description="Test",
            event_type="meeting",
            date=datetime.now()
        )
        db_session.add(event)
        db_session.commit()
        
        response = client.get(
            f"/events/{event.id}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 403
    
    def test_list_events_with_filters(self, client, tenant_manager_token, db_session, tenant):
        """Test listing events with filters"""
        response = client.get(
            "/events?event_type=meeting&limit=10",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        events = response.json()
        assert isinstance(events, list)
    
    def test_event_pagination(self, client, tenant_manager_token):
        """Test event list pagination"""
        response = client.get(
            "/events?skip=0&limit=5",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        events = response.json()
        assert len(events) <= 5


class TestEventsValidation:
    """Tests for event validation"""
    
    def test_invalid_event_type_rejected(self, client, tenant_manager_token):
        """Test invalid event type is rejected"""
        event_data = {
            "title": "Test",
            "description": "Test",
            "event_type": "invalid_type",
            "date": "2026-02-15T10:00:00"
        }
        
        response = client.post(
            "/events",
            json=event_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 422
    
    def test_missing_required_field_rejected(self, client, tenant_manager_token):
        """Test missing required fields are rejected"""
        event_data = {
            "title": "Test",
            # Missing description
            "event_type": "meeting",
            "date": "2026-02-15T10:00:00"
        }
        
        response = client.post(
            "/events",
            json=event_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 422
    
    def test_invalid_date_format_rejected(self, client, tenant_manager_token):
        """Test invalid date format is rejected"""
        event_data = {
            "title": "Test",
            "description": "Test",
            "event_type": "meeting",
            "date": "not-a-date"
        }
        
        response = client.post(
            "/events",
            json=event_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 422


class TestE2EEventWorkflow:
    """End-to-end tests for event workflows"""
    
    def test_e2e_create_list_update_delete_event(self, client, tenant_manager_token, db_session, tenant):
        """E2E: Create → List → Update → Delete event"""
        
        # Step 1: Create event
        event_data = {
            "title": "Team Planning",
            "description": "Q1 planning session",
            "event_type": "meeting",
            "date": "2026-02-15T10:00:00"
        }
        create_response = client.post(
            "/events",
            json=event_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert create_response.status_code in [200, 201]
        event = create_response.json()
        event_id = event['id']
        
        # Step 2: List events (verify it appears)
        list_response = client.get(
            "/events",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert list_response.status_code == 200
        events = list_response.json()
        event_ids = {e['id'] for e in events}
        assert event_id in event_ids
        
        # Step 3: Update event
        update_response = client.patch(
            f"/events/{event_id}",
            json={"title": "Q1 Planning Session"},
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert update_response.status_code == 200
        
        # Step 4: Delete event
        delete_response = client.delete(
            f"/events/{event_id}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert delete_response.status_code == 200
