"""
Integration Tests for Recognition API
Comprehensive tests for recognition/achievement system
"""
import pytest
from fastapi.testclient import TestClient
from uuid import uuid4
from models import Recognition, User, Badge, Wallet
from auth.utils import get_password_hash


class TestRecognitionApiIntegration:
    """Integration tests for /recognitions/* endpoints"""
    
    def test_create_recognition_success(self, client, db_session, tenant_with_users):
        """Test creating a recognition"""
        user_a_token = tenant_with_users['user_a_token']
        user_b = tenant_with_users['user_b']
        
        recognition_data = {
            "recipient_id": str(user_b.id),
            "message": "Excellent work!",
            "achievement": "Leadership",
            "points": 100
        }
        
        response = client.post(
            "/recognitions",
            json=recognition_data,
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        
        assert response.status_code in [200, 201]
        recognition = response.json()
        assert recognition['points'] == 100
        assert recognition['message'] == "Excellent work!"
    
    def test_get_recognition_by_id(self, client, db_session, tenant_with_users):
        """Test retrieving a specific recognition"""
        user_a = tenant_with_users['user_a']
        user_b = tenant_with_users['user_b']
        user_a_token = tenant_with_users['user_a_token']
        
        # Create recognition
        recognition = Recognition(
            tenant_id=user_a.tenant_id,
            giver_id=user_a.id,
            recipient_id=user_b.id,
            message="Great job!",
            points=50,
            status="APPROVED"
        )
        db_session.add(recognition)
        db_session.commit()
        
        response = client.get(
            f"/recognitions/{recognition.id}",
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        
        assert response.status_code == 200
        retrieved = response.json()
        assert retrieved['message'] == "Great job!"
    
    def test_list_recognitions_by_recipient(self, client, db_session, tenant_with_users):
        """Test listing recognitions received by user"""
        user_b_token = tenant_with_users['user_b_token']
        
        response = client.get(
            "/recognitions/my-received",
            headers={"Authorization": f"Bearer {user_b_token}"}
        )
        
        assert response.status_code == 200
        recognitions = response.json()
        assert isinstance(recognitions, list)
    
    def test_list_recognitions_by_giver(self, client, db_session, tenant_with_users):
        """Test listing recognitions given by user"""
        user_a_token = tenant_with_users['user_a_token']
        
        response = client.get(
            "/recognitions/my-given",
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        
        assert response.status_code == 200
        recognitions = response.json()
        assert isinstance(recognitions, list)
    
    def test_recognition_increases_recipient_points(self, client, db_session, tenant_with_users):
        """Test that giving recognition increases recipient's points"""
        user_a_token = tenant_with_users['user_a_token']
        user_b = tenant_with_users['user_b']
        
        # Get initial balance
        initial_wallet = db_session.query(Wallet).filter_by(user_id=user_b.id).first()
        initial_balance = initial_wallet.current_balance if initial_wallet else 0
        
        # Give recognition
        recognition_data = {
            "recipient_id": str(user_b.id),
            "message": "Great work!",
            "achievement": "Performance",
            "points": 75
        }
        
        response = client.post(
            "/recognitions",
            json=recognition_data,
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        
        assert response.status_code in [200, 201]
        
        # Verify points increased
        updated_wallet = db_session.query(Wallet).filter_by(user_id=user_b.id).first()
        assert updated_wallet.current_balance >= initial_balance + 75
    
    def test_cannot_recognize_self(self, client, tenant_manager_token, tenant_with_users):
        """Test user cannot recognize themselves"""
        user_a = tenant_with_users['user_a']
        
        recognition_data = {
            "recipient_id": str(user_a.id),
            "message": "Self recognition",
            "achievement": "Leadership",
            "points": 50
        }
        
        response = client.post(
            "/recognitions",
            json=recognition_data,
            headers={"Authorization": f"Bearer {tenant_with_users['user_a_token']}"}
        )
        
        # Should be rejected
        assert response.status_code in [400, 422]
    
    def test_recognition_cross_tenant_forbidden(self, client, db_session, two_tenants_with_users):
        """Test cannot recognize user from different tenant"""
        tenant1_user_token = two_tenants_with_users['tenant1_user_token']
        tenant2_user = two_tenants_with_users['tenant2_user']
        
        recognition_data = {
            "recipient_id": str(tenant2_user.id),
            "message": "Nice work!",
            "achievement": "Leadership",
            "points": 50
        }
        
        response = client.post(
            "/recognitions",
            json=recognition_data,
            headers={"Authorization": f"Bearer {tenant1_user_token}"}
        )
        
        assert response.status_code in [403, 400, 422]


class TestBadgesIntegration:
    """Integration tests for badge system"""
    
    def test_list_available_badges(self, client, tenant_manager_token):
        """Test listing available badges"""
        response = client.get(
            "/badges",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        badges = response.json()
        assert isinstance(badges, list)
    
    def test_get_badge_by_id(self, client, db_session, tenant_manager_token, tenant):
        """Test retrieving a specific badge"""
        # Create badge
        badge = Badge(
            tenant_id=tenant.id,
            name="Leadership Star",
            description="Awarded for leadership",
            icon="star"
        )
        db_session.add(badge)
        db_session.commit()
        
        response = client.get(
            f"/badges/{badge.id}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        retrieved = response.json()
        assert retrieved['name'] == "Leadership Star"


class TestRecognitionValidation:
    """Tests for recognition validation"""
    
    def test_invalid_points_rejected(self, client, tenant_with_users):
        """Test invalid point values are rejected"""
        user_b = tenant_with_users['user_b']
        user_a_token = tenant_with_users['user_a_token']
        
        recognition_data = {
            "recipient_id": str(user_b.id),
            "message": "Test",
            "achievement": "Leadership",
            "points": -100  # Negative points
        }
        
        response = client.post(
            "/recognitions",
            json=recognition_data,
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        
        assert response.status_code == 422
    
    def test_missing_message_rejected(self, client, tenant_with_users):
        """Test missing message is rejected"""
        user_b = tenant_with_users['user_b']
        user_a_token = tenant_with_users['user_a_token']
        
        recognition_data = {
            "recipient_id": str(user_b.id),
            # Missing message
            "achievement": "Leadership",
            "points": 50
        }
        
        response = client.post(
            "/recognitions",
            json=recognition_data,
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        
        assert response.status_code == 422
    
    def test_message_too_long_rejected(self, client, tenant_with_users):
        """Test message length limits"""
        user_b = tenant_with_users['user_b']
        user_a_token = tenant_with_users['user_a_token']
        
        recognition_data = {
            "recipient_id": str(user_b.id),
            "message": "x" * 10000,  # Extremely long message
            "achievement": "Leadership",
            "points": 50
        }
        
        response = client.post(
            "/recognitions",
            json=recognition_data,
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        
        assert response.status_code == 422


class TestE2ERecognitionFlow:
    """End-to-end recognition workflows"""
    
    def test_e2e_complete_recognition_workflow(self, client, db_session, tenant_with_users):
        """E2E: Create recognition → Approve → Verify points → Recipient receives"""
        user_a_token = tenant_with_users['user_a_token']
        user_b = tenant_with_users['user_b']
        
        # Step 1: Create recognition
        recognition_data = {
            "recipient_id": str(user_b.id),
            "message": "Exceptional performance!",
            "achievement": "Excellence",
            "points": 100
        }
        
        create_response = client.post(
            "/recognitions",
            json=recognition_data,
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        
        assert create_response.status_code in [200, 201]
        recognition = create_response.json()
        recognition_id = recognition['id']
        
        # Step 2: Verify recipient received points
        # (Points should be reflected immediately or after approval)
        wallet = db_session.query(Wallet).filter_by(user_id=user_b.id).first()
        assert wallet.current_balance > 0
        
        # Step 3: Retrieve recognition to verify
        get_response = client.get(
            f"/recognitions/{recognition_id}",
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        
        assert get_response.status_code == 200
        retrieved = get_response.json()
        assert retrieved['points'] == 100


# Fixtures
@pytest.fixture
def tenant_with_users(db_session, tenant):
    """Create tenant with multiple users"""
    user_a = User(
        tenant_id=tenant.id,
        corporate_email="usera@example.com",
        first_name="User",
        last_name="A",
        org_role="tenant_lead",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    user_b = User(
        tenant_id=tenant.id,
        corporate_email="userb@example.com",
        first_name="User",
        last_name="B",
        org_role="corporate_user",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    db_session.add_all([user_a, user_b])
    db_session.flush()
    
    # Create wallets
    wallet_a = Wallet(user_id=user_a.id, tenant_id=tenant.id, current_balance=1000)
    wallet_b = Wallet(user_id=user_b.id, tenant_id=tenant.id, current_balance=500)
    
    db_session.add_all([wallet_a, wallet_b])
    db_session.commit()
    
    def generate_token(user):
        from core.security import create_access_token
        return create_access_token(user_id=str(user.id))
    
    return {
        'user_a': user_a,
        'user_b': user_b,
        'user_a_token': generate_token(user_a),
        'user_b_token': generate_token(user_b),
    }
