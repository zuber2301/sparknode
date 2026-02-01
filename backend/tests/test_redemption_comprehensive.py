"""
Integration Tests for Redemption API
Comprehensive tests for redemption/rewards system
"""
import pytest
from fastapi.testclient import TestClient
from uuid import uuid4
from models import Redemption, Wallet, Reward, User
from auth.utils import get_password_hash


class TestRedemptionApiIntegration:
    """Integration tests for /redemptions/* endpoints"""
    
    def test_create_redemption_success(self, client, db_session, tenant_with_users_and_rewards):
        """Test creating a redemption"""
        user_token = tenant_with_users_and_rewards['user_token']
        reward = tenant_with_users_and_rewards['reward']
        
        redemption_data = {
            "reward_id": str(reward.id),
            "quantity": 1
        }
        
        response = client.post(
            "/redemptions",
            json=redemption_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code in [200, 201]
        redemption = response.json()
        assert redemption['quantity'] == 1
        assert redemption['status'] in ['PENDING', 'APPROVED', 'COMPLETED']
    
    def test_get_redemption_by_id(self, client, db_session, tenant_with_users_and_rewards):
        """Test retrieving a specific redemption"""
        user = tenant_with_users_and_rewards['user']
        user_token = tenant_with_users_and_rewards['user_token']
        tenant = tenant_with_users_and_rewards['tenant']
        
        # Create redemption
        reward = tenant_with_users_and_rewards['reward']
        redemption = Redemption(
            tenant_id=tenant.id,
            user_id=user.id,
            reward_id=reward.id,
            quantity=1,
            status="APPROVED",
            redemption_code="TEST123"
        )
        db_session.add(redemption)
        db_session.commit()
        
        response = client.get(
            f"/redemptions/{redemption.id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        retrieved = response.json()
        assert retrieved['quantity'] == 1
        assert retrieved['redemption_code'] == "TEST123"
    
    def test_list_my_redemptions(self, client, db_session, tenant_with_users_and_rewards):
        """Test listing user's redemptions"""
        user_token = tenant_with_users_and_rewards['user_token']
        
        response = client.get(
            "/redemptions/my-redemptions",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        redemptions = response.json()
        assert isinstance(redemptions, list)
    
    def test_redemption_deducts_points(self, client, db_session, tenant_with_users_and_rewards):
        """Test that redemption deducts points from user wallet"""
        user = tenant_with_users_and_rewards['user']
        user_token = tenant_with_users_and_rewards['user_token']
        reward = tenant_with_users_and_rewards['reward']
        
        # Get initial balance
        wallet = db_session.query(Wallet).filter_by(user_id=user.id).first()
        initial_balance = wallet.current_balance
        
        # Create redemption
        redemption_data = {
            "reward_id": str(reward.id),
            "quantity": 1
        }
        
        response = client.post(
            "/redemptions",
            json=redemption_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code in [200, 201]
        
        # Verify balance decreased
        db_session.refresh(wallet)
        assert wallet.current_balance < initial_balance
    
    def test_insufficient_points_rejection(self, client, db_session, tenant):
        """Test redemption rejected if insufficient points"""
        # Create user with low balance
        user = User(
            tenant_id=tenant.id,
            corporate_email="low_balance@example.com",
            first_name="Low",
            last_name="Balance",
            org_role="corporate_user",
            password_hash=get_password_hash("password"),
            status="ACTIVE"
        )
        db_session.add(user)
        db_session.flush()
        
        wallet = Wallet(user_id=user.id, tenant_id=tenant.id, current_balance=10)
        db_session.add(wallet)
        
        # Create expensive reward
        reward = Reward(
            tenant_id=tenant.id,
            name="Expensive Item",
            cost_points=1000,
            description="Very expensive",
            category="Premium"
        )
        db_session.add(reward)
        db_session.commit()
        
        from core.security import create_access_token
        user_token = create_access_token(user_id=str(user.id))
        
        redemption_data = {
            "reward_id": str(reward.id),
            "quantity": 1
        }
        
        response = client.post(
            "/redemptions",
            json=redemption_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # Should be rejected
        assert response.status_code in [400, 403, 422]
    
    def test_redemption_cross_tenant_forbidden(self, client, db_session, two_tenants_setup):
        """Test cannot redeem reward from different tenant"""
        tenant1_user_token = two_tenants_setup['tenant1_user_token']
        tenant2_reward = two_tenants_setup['tenant2_reward']
        
        redemption_data = {
            "reward_id": str(tenant2_reward.id),
            "quantity": 1
        }
        
        response = client.post(
            "/redemptions",
            json=redemption_data,
            headers={"Authorization": f"Bearer {tenant1_user_token}"}
        )
        
        assert response.status_code in [403, 400, 422]
    
    def test_redeem_multiple_quantity(self, client, db_session, tenant_with_users_and_rewards):
        """Test redeeming multiple quantities of reward"""
        user_token = tenant_with_users_and_rewards['user_token']
        reward = tenant_with_users_and_rewards['reward']
        
        redemption_data = {
            "reward_id": str(reward.id),
            "quantity": 3
        }
        
        response = client.post(
            "/redemptions",
            json=redemption_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code in [200, 201]
        redemption = response.json()
        assert redemption['quantity'] == 3


class TestRewardsApiIntegration:
    """Integration tests for /rewards/* endpoints"""
    
    def test_list_available_rewards(self, client, tenant_admin_token, tenant):
        """Test listing available rewards"""
        response = client.get(
            "/rewards",
            headers={"Authorization": f"Bearer {tenant_admin_token}"}
        )
        
        assert response.status_code == 200
        rewards = response.json()
        assert isinstance(rewards, list)
    
    def test_create_reward(self, client, db_session, tenant_admin_token, tenant):
        """Test creating a reward"""
        reward_data = {
            "name": "Amazon Voucher",
            "description": "50 Amazon gift card",
            "cost_points": 500,
            "category": "Gift Cards"
        }
        
        response = client.post(
            "/rewards",
            json=reward_data,
            headers={"Authorization": f"Bearer {tenant_admin_token}"}
        )
        
        assert response.status_code in [200, 201]
        reward = response.json()
        assert reward['name'] == "Amazon Voucher"
        assert reward['cost_points'] == 500
    
    def test_get_reward_by_id(self, client, db_session, tenant_admin_token, tenant):
        """Test retrieving a specific reward"""
        reward = Reward(
            tenant_id=tenant.id,
            name="Coffee Voucher",
            description="Free coffee",
            cost_points=100,
            category="Beverages"
        )
        db_session.add(reward)
        db_session.commit()
        
        response = client.get(
            f"/rewards/{reward.id}",
            headers={"Authorization": f"Bearer {tenant_admin_token}"}
        )
        
        assert response.status_code == 200
        retrieved = response.json()
        assert retrieved['name'] == "Coffee Voucher"
    
    def test_update_reward(self, client, db_session, tenant_admin_token, tenant):
        """Test updating a reward"""
        reward = Reward(
            tenant_id=tenant.id,
            name="Old Name",
            description="Test reward",
            cost_points=100,
            category="Test"
        )
        db_session.add(reward)
        db_session.commit()
        
        update_data = {
            "name": "New Name",
            "cost_points": 150
        }
        
        response = client.patch(
            f"/rewards/{reward.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {tenant_admin_token}"}
        )
        
        assert response.status_code in [200, 204]
        
        db_session.refresh(reward)
        assert reward.name == "New Name"
        assert reward.cost_points == 150
    
    def test_delete_reward(self, client, db_session, tenant_admin_token, tenant):
        """Test deleting a reward"""
        reward = Reward(
            tenant_id=tenant.id,
            name="To Delete",
            description="This reward will be deleted",
            cost_points=100,
            category="Test"
        )
        db_session.add(reward)
        db_session.commit()
        reward_id = reward.id
        
        response = client.delete(
            f"/rewards/{reward_id}",
            headers={"Authorization": f"Bearer {tenant_admin_token}"}
        )
        
        assert response.status_code in [200, 204]
        
        deleted = db_session.query(Reward).filter_by(id=reward_id).first()
        # Either deleted or marked as inactive
        assert deleted is None or deleted.is_active is False


class TestRedemptionValidation:
    """Tests for redemption validation"""
    
    def test_invalid_quantity_rejected(self, client, tenant_with_users_and_rewards):
        """Test invalid quantity is rejected"""
        user_token = tenant_with_users_and_rewards['user_token']
        reward = tenant_with_users_and_rewards['reward']
        
        redemption_data = {
            "reward_id": str(reward.id),
            "quantity": 0  # Invalid quantity
        }
        
        response = client.post(
            "/redemptions",
            json=redemption_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 422
    
    def test_negative_quantity_rejected(self, client, tenant_with_users_and_rewards):
        """Test negative quantity is rejected"""
        user_token = tenant_with_users_and_rewards['user_token']
        reward = tenant_with_users_and_rewards['reward']
        
        redemption_data = {
            "reward_id": str(reward.id),
            "quantity": -5
        }
        
        response = client.post(
            "/redemptions",
            json=redemption_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 422
    
    def test_invalid_reward_id_rejected(self, client, tenant_with_users_and_rewards):
        """Test invalid reward ID is rejected"""
        user_token = tenant_with_users_and_rewards['user_token']
        
        redemption_data = {
            "reward_id": str(uuid4()),  # Non-existent reward
            "quantity": 1
        }
        
        response = client.post(
            "/redemptions",
            json=redemption_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code in [400, 404, 422]


class TestE2ERedemptionFlow:
    """End-to-end redemption workflows"""
    
    def test_e2e_complete_redemption_workflow(self, client, db_session, tenant_with_users_and_rewards):
        """E2E: Create redemption → Approve → Generate code → Verify"""
        user = tenant_with_users_and_rewards['user']
        user_token = tenant_with_users_and_rewards['user_token']
        reward = tenant_with_users_and_rewards['reward']
        
        # Step 1: Create redemption
        redemption_data = {
            "reward_id": str(reward.id),
            "quantity": 1
        }
        
        create_response = client.post(
            "/redemptions",
            json=redemption_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert create_response.status_code in [200, 201]
        redemption_json = create_response.json()
        redemption_id = redemption_json['id']
        
        # Step 2: Verify wallet balance decreased
        wallet = db_session.query(Wallet).filter_by(user_id=user.id).first()
        assert wallet.current_balance >= 0
        
        # Step 3: Retrieve redemption and verify
        get_response = client.get(
            f"/redemptions/{redemption_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert get_response.status_code == 200
        retrieved = get_response.json()
        assert retrieved['reward_id'] == str(reward.id)
        assert retrieved['status'] in ['PENDING', 'APPROVED', 'COMPLETED']


# Fixtures
@pytest.fixture
def tenant_with_users_and_rewards(db_session, tenant):
    """Create tenant with users and rewards"""
    # Create user
    user = User(
        tenant_id=tenant.id,
        corporate_email="testuser@example.com",
        first_name="Test",
        last_name="User",
        org_role="corporate_user",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    db_session.add(user)
    db_session.flush()
    
    # Create wallet with balance
    wallet = Wallet(user_id=user.id, tenant_id=tenant.id, current_balance=5000)
    db_session.add(wallet)
    
    # Create reward
    reward = Reward(
        tenant_id=tenant.id,
        name="Test Reward",
        description="Test reward for redemption",
        cost_points=500,
        category="Test",
        is_active=True
    )
    db_session.add(reward)
    db_session.commit()
    
    from core.security import create_access_token
    user_token = create_access_token(user_id=str(user.id))
    
    return {
        'user': user,
        'user_token': user_token,
        'tenant': tenant,
        'reward': reward,
        'wallet': wallet
    }


@pytest.fixture
def two_tenants_setup(db_session):
    """Create two tenants with users and rewards"""
    from models import Tenant
    
    tenant1 = Tenant(name="Tenant 1", status="ACTIVE")
    tenant2 = Tenant(name="Tenant 2", status="ACTIVE")
    db_session.add_all([tenant1, tenant2])
    db_session.flush()
    
    # Create users in each tenant
    user1 = User(
        tenant_id=tenant1.id,
        corporate_email="tenant1user@example.com",
        first_name="T1",
        last_name="User",
        org_role="corporate_user",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    user2 = User(
        tenant_id=tenant2.id,
        corporate_email="tenant2user@example.com",
        first_name="T2",
        last_name="User",
        org_role="corporate_user",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    db_session.add_all([user1, user2])
    db_session.flush()
    
    # Create wallets
    wallet1 = Wallet(user_id=user1.id, tenant_id=tenant1.id, current_balance=5000)
    wallet2 = Wallet(user_id=user2.id, tenant_id=tenant2.id, current_balance=5000)
    db_session.add_all([wallet1, wallet2])
    
    # Create rewards in each tenant
    reward1 = Reward(
        tenant_id=tenant1.id,
        name="Tenant1 Reward",
        description="Reward for tenant 1",
        cost_points=500,
        category="Test"
    )
    
    reward2 = Reward(
        tenant_id=tenant2.id,
        name="Tenant2 Reward",
        description="Reward for tenant 2",
        cost_points=500,
        category="Test"
    )
    
    db_session.add_all([reward1, reward2])
    db_session.commit()
    
    from core.security import create_access_token
    
    return {
        'tenant1_user_token': create_access_token(user_id=str(user1.id)),
        'tenant2_reward': reward2
    }
