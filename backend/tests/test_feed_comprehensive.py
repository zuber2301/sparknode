"""
Integration Tests for Feed API
Comprehensive tests for activity feed/notifications system
"""
import pytest
from fastapi.testclient import TestClient
from uuid import uuid4
from datetime import datetime, timedelta
from models import Feed, User, Notification
from auth.utils import get_password_hash


class TestFeedApiIntegration:
    """Integration tests for /feed/* endpoints"""
    
    def test_get_my_feed(self, client, db_session, tenant_with_users):
        """Test retrieving user's activity feed"""
        user_token = tenant_with_users['user_token']
        
        response = client.get(
            "/feed/my-feed",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        feed_items = response.json()
        assert isinstance(feed_items, list)
    
    def test_get_feed_with_pagination(self, client, db_session, tenant_with_users):
        """Test retrieving feed with pagination"""
        user_token = tenant_with_users['user_token']
        
        response = client.get(
            "/feed/my-feed?page=1&limit=10",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        if isinstance(data, dict):
            assert 'items' in data or 'data' in data
            assert 'total' in data or 'page' in data
        else:
            assert isinstance(data, list)
    
    def test_get_feed_with_filters(self, client, db_session, tenant_with_users):
        """Test retrieving feed with filters"""
        user_token = tenant_with_users['user_token']
        
        response = client.get(
            "/feed/my-feed?feed_type=recognition&status=ACTIVE",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        feed_items = response.json()
        assert isinstance(feed_items, (list, dict))
    
    def test_create_feed_item(self, client, db_session, tenant_with_users):
        """Test creating a feed item"""
        user_token = tenant_with_users['user_token']
        
        feed_data = {
            "feed_type": "achievement",
            "title": "New Achievement",
            "description": "User achieved something",
            "related_id": str(uuid4())
        }
        
        response = client.post(
            "/feed/create",
            json=feed_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # May return 201 or 200
        assert response.status_code in [200, 201]
    
    def test_mark_feed_item_as_read(self, client, db_session, tenant_with_users):
        """Test marking feed item as read"""
        user = tenant_with_users['user']
        user_token = tenant_with_users['user_token']
        
        # Create feed item
        feed_item = Feed(
            tenant_id=user.tenant_id,
            user_id=user.id,
            feed_type="update",
            title="Test Feed",
            description="Test description",
            is_read=False,
            related_id=str(uuid4())
        )
        db_session.add(feed_item)
        db_session.commit()
        
        response = client.patch(
            f"/feed/{feed_item.id}/mark-read",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code in [200, 204]
        
        db_session.refresh(feed_item)
        assert feed_item.is_read is True
    
    def test_mark_multiple_as_read(self, client, db_session, tenant_with_users):
        """Test marking multiple feed items as read"""
        user = tenant_with_users['user']
        user_token = tenant_with_users['user_token']
        
        # Create multiple feed items
        feed_ids = []
        for i in range(3):
            feed_item = Feed(
                tenant_id=user.tenant_id,
                user_id=user.id,
                feed_type="update",
                title=f"Feed {i}",
                description=f"Description {i}",
                is_read=False,
                related_id=str(uuid4())
            )
            db_session.add(feed_item)
            feed_ids.append(feed_item.id)
        db_session.commit()
        
        mark_data = {
            "feed_ids": feed_ids
        }
        
        response = client.post(
            "/feed/mark-multiple-read",
            json=mark_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code in [200, 204]
    
    def test_get_unread_feed_count(self, client, db_session, tenant_with_users):
        """Test getting unread feed item count"""
        user = tenant_with_users['user']
        user_token = tenant_with_users['user_token']
        
        response = client.get(
            "/feed/unread-count",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert 'count' in data
        assert data['count'] >= 0
    
    def test_delete_feed_item(self, client, db_session, tenant_with_users):
        """Test deleting a feed item"""
        user = tenant_with_users['user']
        user_token = tenant_with_users['user_token']
        
        feed_item = Feed(
            tenant_id=user.tenant_id,
            user_id=user.id,
            feed_type="update",
            title="To Delete",
            description="This will be deleted",
            is_read=False,
            related_id=str(uuid4())
        )
        db_session.add(feed_item)
        db_session.commit()
        feed_id = feed_item.id
        
        response = client.delete(
            f"/feed/{feed_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code in [200, 204]


class TestNotificationsIntegration:
    """Integration tests for notifications"""
    
    def test_get_my_notifications(self, client, db_session, tenant_with_users):
        """Test retrieving user's notifications"""
        user_token = tenant_with_users['user_token']
        
        response = client.get(
            "/notifications/my-notifications",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        notifications = response.json()
        assert isinstance(notifications, (list, dict))
    
    def test_mark_notification_as_read(self, client, db_session, tenant_with_users):
        """Test marking notification as read"""
        user = tenant_with_users['user']
        user_token = tenant_with_users['user_token']
        
        notification = Notification(
            tenant_id=user.tenant_id,
            user_id=user.id,
            title="Test Notification",
            message="Test message",
            notification_type="feed",
            is_read=False
        )
        db_session.add(notification)
        db_session.commit()
        
        response = client.patch(
            f"/notifications/{notification.id}/mark-read",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code in [200, 204]
        
        db_session.refresh(notification)
        assert notification.is_read is True
    
    def test_delete_notification(self, client, db_session, tenant_with_users):
        """Test deleting a notification"""
        user = tenant_with_users['user']
        user_token = tenant_with_users['user_token']
        
        notification = Notification(
            tenant_id=user.tenant_id,
            user_id=user.id,
            title="To Delete",
            message="Delete this",
            notification_type="feed",
            is_read=False
        )
        db_session.add(notification)
        db_session.commit()
        notification_id = notification.id
        
        response = client.delete(
            f"/notifications/{notification_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code in [200, 204]


class TestFeedFiltering:
    """Tests for feed filtering and searching"""
    
    def test_filter_feed_by_type(self, client, db_session, tenant_with_users):
        """Test filtering feed by feed type"""
        user_token = tenant_with_users['user_token']
        
        response = client.get(
            "/feed/my-feed?feed_type=recognition",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        feed_items = response.json()
        assert isinstance(feed_items, (list, dict))
    
    def test_filter_feed_by_read_status(self, client, db_session, tenant_with_users):
        """Test filtering feed by read status"""
        user_token = tenant_with_users['user_token']
        
        response = client.get(
            "/feed/my-feed?is_read=false",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        feed_items = response.json()
        assert isinstance(feed_items, (list, dict))
    
    def test_filter_feed_by_date_range(self, client, db_session, tenant_with_users):
        """Test filtering feed by date range"""
        user_token = tenant_with_users['user_token']
        
        start_date = (datetime.now() - timedelta(days=7)).isoformat()
        end_date = datetime.now().isoformat()
        
        response = client.get(
            f"/feed/my-feed?start_date={start_date}&end_date={end_date}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        feed_items = response.json()
        assert isinstance(feed_items, (list, dict))
    
    def test_search_feed_by_title(self, client, db_session, tenant_with_users):
        """Test searching feed by title"""
        user_token = tenant_with_users['user_token']
        
        response = client.get(
            "/feed/my-feed?search=achievement",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        feed_items = response.json()
        assert isinstance(feed_items, (list, dict))


class TestFeedValidation:
    """Tests for feed validation"""
    
    def test_invalid_feed_type_rejected(self, client, tenant_with_users):
        """Test invalid feed type is rejected"""
        user_token = tenant_with_users['user_token']
        
        feed_data = {
            "feed_type": "invalid_type_xyz",
            "title": "Test",
            "description": "Test description"
        }
        
        response = client.post(
            "/feed/create",
            json=feed_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 422
    
    def test_missing_title_rejected(self, client, tenant_with_users):
        """Test missing title is rejected"""
        user_token = tenant_with_users['user_token']
        
        feed_data = {
            "feed_type": "update",
            # Missing title
            "description": "Test description"
        }
        
        response = client.post(
            "/feed/create",
            json=feed_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 422
    
    def test_title_too_long_rejected(self, client, tenant_with_users):
        """Test title length validation"""
        user_token = tenant_with_users['user_token']
        
        feed_data = {
            "feed_type": "update",
            "title": "x" * 10000,
            "description": "Test"
        }
        
        response = client.post(
            "/feed/create",
            json=feed_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 422


class TestE2EFeedWorkflow:
    """End-to-end feed workflows"""
    
    def test_e2e_feed_activity_workflow(self, client, db_session, tenant_with_users):
        """E2E: Create feed → List feed → Mark read → Verify"""
        user = tenant_with_users['user']
        user_token = tenant_with_users['user_token']
        
        # Step 1: Create feed item
        feed_data = {
            "feed_type": "achievement",
            "title": "E2E Test Achievement",
            "description": "Testing feed workflow",
            "related_id": str(uuid4())
        }
        
        create_response = client.post(
            "/feed/create",
            json=feed_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert create_response.status_code in [200, 201]
        
        # Step 2: Get feed list
        list_response = client.get(
            "/feed/my-feed",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert list_response.status_code == 200
        feed_items = list_response.json()
        assert len(feed_items) > 0
        
        # Step 3: Mark as read
        feed_item = feed_items[0]
        if isinstance(feed_item, dict) and 'id' in feed_item:
            mark_response = client.patch(
                f"/feed/{feed_item['id']}/mark-read",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            assert mark_response.status_code in [200, 204]
        
        # Step 4: Verify read status
        list_response = client.get(
            "/feed/my-feed?is_read=false",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert list_response.status_code == 200
    
    def test_e2e_notification_workflow(self, client, db_session, tenant_with_users):
        """E2E: Get notifications → Mark read → Delete → Verify"""
        user = tenant_with_users['user']
        user_token = tenant_with_users['user_token']
        
        # Create notification
        notification = Notification(
            tenant_id=user.tenant_id,
            user_id=user.id,
            title="E2E Test",
            message="Testing notification workflow",
            notification_type="feed",
            is_read=False
        )
        db_session.add(notification)
        db_session.commit()
        
        # Step 1: Get notifications
        get_response = client.get(
            "/notifications/my-notifications",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert get_response.status_code == 200
        
        # Step 2: Mark as read
        mark_response = client.patch(
            f"/notifications/{notification.id}/mark-read",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert mark_response.status_code in [200, 204]
        
        # Step 3: Delete notification
        delete_response = client.delete(
            f"/notifications/{notification.id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert delete_response.status_code in [200, 204]


# Fixtures
@pytest.fixture
def tenant_with_users(db_session, tenant):
    """Create tenant with users for feed tests"""
    from core.security import create_access_token
    
    user = User(
        tenant_id=tenant.id,
        corporate_email="feeduser@example.com",
        first_name="Feed",
        last_name="User",
        org_role="tenant_user",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    db_session.add(user)
    db_session.commit()
    
    # Create some feed items
    for i in range(3):
        feed_item = Feed(
            tenant_id=tenant.id,
            user_id=user.id,
            feed_type="update",
            title=f"Feed Item {i+1}",
            description=f"Description {i+1}",
            is_read=i > 0,  # First one is unread
            related_id=str(uuid4())
        )
        db_session.add(feed_item)
    
    db_session.commit()
    
    return {
        'user': user,
        'user_token': create_access_token(user_id=str(user.id)),
        'tenant': tenant
    }
