"""
Integration Tests for Wallets API
Comprehensive tests for wallet/balance/ledger system
"""
import pytest
from fastapi.testclient import TestClient
from uuid import uuid4
from models import Wallet, WalletTransaction, User
from auth.utils import get_password_hash


class TestWalletsApiIntegration:
    """Integration tests for /wallets/* endpoints"""
    
    def test_get_my_wallet(self, client, db_session, tenant_with_wallet):
        """Test retrieving user's wallet"""
        user_token = tenant_with_wallet['user_token']
        
        response = client.get(
            "/wallets/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        wallet = response.json()
        assert 'current_balance' in wallet
        assert wallet['current_balance'] >= 0
    
    def test_get_wallet_balance_by_user_id(self, client, db_session, tenant_with_multiple_users):
        """Test retrieving wallet for a specific user"""
        admin_token = tenant_with_multiple_users['admin_token']
        user = tenant_with_multiple_users['user']
        
        response = client.get(
            f"/wallets/user/{user.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        wallet = response.json()
        assert wallet['current_balance'] >= 0
    
    def test_wallet_transaction_history(self, client, db_session, tenant_with_wallet):
        """Test retrieving wallet transaction history"""
        user_token = tenant_with_wallet['user_token']
        
        response = client.get(
            "/wallets/me/transactions",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        transactions = response.json()
        assert isinstance(transactions, list)
    
    def test_wallet_statement_by_date_range(self, client, db_session, tenant_with_wallet):
        """Test wallet statement for date range"""
        user_token = tenant_with_wallet['user_token']
        
        response = client.get(
            "/wallets/me/statement?start_date=2024-01-01&end_date=2024-12-31",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        statement = response.json()
        assert isinstance(statement, (list, dict))
    
    def test_add_points_to_wallet(self, client, db_session, tenant_with_wallet):
        """Test adding points to wallet (admin operation)"""
        admin_token = tenant_with_wallet['admin_token']
        user = tenant_with_wallet['user']
        
        initial_balance = user.wallet.current_balance
        
        update_data = {
            "amount": 500,
            "reason": "Bonus points"
        }
        
        response = client.post(
            f"/wallets/user/{user.id}/add-points",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code in [200, 201]
        db_session.refresh(user.wallet)
        assert user.wallet.current_balance == initial_balance + 500
    
    def test_deduct_points_from_wallet(self, client, db_session, tenant_with_wallet):
        """Test deducting points from wallet"""
        admin_token = tenant_with_wallet['admin_token']
        user = tenant_with_wallet['user']
        
        initial_balance = user.wallet.current_balance
        
        deduct_data = {
            "amount": 100,
            "reason": "Penalty"
        }
        
        response = client.post(
            f"/wallets/user/{user.id}/deduct-points",
            json=deduct_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code in [200, 201]
        db_session.refresh(user.wallet)
        assert user.wallet.current_balance == initial_balance - 100
    
    def test_transfer_points_between_users(self, client, db_session, tenant_with_multiple_users):
        """Test transferring points between users"""
        user1_token = tenant_with_multiple_users['user1_token']
        user2 = tenant_with_multiple_users['user2']
        user1 = tenant_with_multiple_users['user']
        
        user1_initial = user1.wallet.current_balance
        user2_initial = user2.wallet.current_balance
        
        transfer_data = {
            "recipient_id": str(user2.id),
            "amount": 200
        }
        
        response = client.post(
            "/wallets/transfer",
            json=transfer_data,
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code in [200, 201]
        
        db_session.refresh(user1.wallet)
        db_session.refresh(user2.wallet)
        assert user1.wallet.current_balance == user1_initial - 200
        assert user2.wallet.current_balance == user2_initial + 200
    
    def test_cannot_transfer_more_than_balance(self, client, db_session, tenant_with_multiple_users):
        """Test cannot transfer more points than available"""
        user1_token = tenant_with_multiple_users['user1_token']
        user2 = tenant_with_multiple_users['user2']
        
        transfer_data = {
            "recipient_id": str(user2.id),
            "amount": 999999  # More than available
        }
        
        response = client.post(
            "/wallets/transfer",
            json=transfer_data,
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code in [400, 403, 422]
    
    def test_cannot_transfer_to_different_tenant(self, client, db_session, two_tenants_with_users):
        """Test cannot transfer to user in different tenant"""
        tenant1_user_token = two_tenants_with_users['tenant1_user_token']
        tenant2_user = two_tenants_with_users['tenant2_user']
        
        transfer_data = {
            "recipient_id": str(tenant2_user.id),
            "amount": 100
        }
        
        response = client.post(
            "/wallets/transfer",
            json=transfer_data,
            headers={"Authorization": f"Bearer {tenant1_user_token}"}
        )
        
        assert response.status_code in [403, 400, 422]


class TestWalletTransactions:
    """Tests for wallet transactions and ledger"""
    
    def test_transaction_recorded_on_points_add(self, client, db_session, tenant_with_wallet):
        """Test that transaction is recorded when points added"""
        admin_token = tenant_with_wallet['admin_token']
        user = tenant_with_wallet['user']
        
        # Add points
        update_data = {
            "amount": 250,
            "reason": "Bonus"
        }
        
        response = client.post(
            f"/wallets/user/{user.id}/add-points",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code in [200, 201]
        
        # Verify transaction recorded
        transaction = db_session.query(WalletTransaction)\
            .filter_by(wallet_id=user.wallet.id)\
            .order_by(WalletTransaction.created_at.desc())\
            .first()
        
        assert transaction is not None
        assert transaction.amount == 250
        assert transaction.transaction_type == "CREDIT"
    
    def test_transaction_recorded_on_points_deduct(self, client, db_session, tenant_with_wallet):
        """Test that transaction is recorded when points deducted"""
        admin_token = tenant_with_wallet['admin_token']
        user = tenant_with_wallet['user']
        
        # Deduct points
        deduct_data = {
            "amount": 75,
            "reason": "Adjustment"
        }
        
        response = client.post(
            f"/wallets/user/{user.id}/deduct-points",
            json=deduct_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code in [200, 201]
        
        # Verify transaction recorded
        transaction = db_session.query(WalletTransaction)\
            .filter_by(wallet_id=user.wallet.id)\
            .order_by(WalletTransaction.created_at.desc())\
            .first()
        
        assert transaction is not None
        assert transaction.amount == 75
        assert transaction.transaction_type == "DEBIT"
    
    def test_transaction_includes_metadata(self, client, db_session, tenant_with_wallet):
        """Test that transactions store proper metadata"""
        admin_token = tenant_with_wallet['admin_token']
        user = tenant_with_wallet['user']
        
        update_data = {
            "amount": 500,
            "reason": "Performance bonus"
        }
        
        response = client.post(
            f"/wallets/user/{user.id}/add-points",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code in [200, 201]
        
        transaction = db_session.query(WalletTransaction)\
            .filter_by(wallet_id=user.wallet.id)\
            .order_by(WalletTransaction.created_at.desc())\
            .first()
        
        assert transaction.description == "Performance bonus"


class TestWalletValidation:
    """Tests for wallet validation"""
    
    def test_invalid_amount_rejected(self, client, tenant_with_wallet):
        """Test invalid amount is rejected"""
        admin_token = tenant_with_wallet['admin_token']
        user = tenant_with_wallet['user']
        
        update_data = {
            "amount": -100,  # Negative amount
            "reason": "Bonus"
        }
        
        response = client.post(
            f"/wallets/user/{user.id}/add-points",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 422
    
    def test_zero_amount_rejected(self, client, tenant_with_wallet):
        """Test zero amount is rejected"""
        admin_token = tenant_with_wallet['admin_token']
        user = tenant_with_wallet['user']
        
        update_data = {
            "amount": 0,
            "reason": "Test"
        }
        
        response = client.post(
            f"/wallets/user/{user.id}/add-points",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 422
    
    def test_missing_reason_rejected(self, client, tenant_with_wallet):
        """Test missing reason is rejected"""
        admin_token = tenant_with_wallet['admin_token']
        user = tenant_with_wallet['user']
        
        update_data = {
            "amount": 100
            # Missing reason
        }
        
        response = client.post(
            f"/wallets/user/{user.id}/add-points",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 422


class TestWalletAuditTrail:
    """Tests for wallet audit and compliance"""
    
    def test_all_transactions_audited(self, client, db_session, tenant_with_wallet):
        """Test that all transactions are properly audited"""
        admin_token = tenant_with_wallet['admin_token']
        user = tenant_with_wallet['user']
        
        # Perform multiple transactions
        for i in range(3):
            update_data = {
                "amount": 100 * (i + 1),
                "reason": f"Transaction {i+1}"
            }
            
            response = client.post(
                f"/wallets/user/{user.id}/add-points",
                json=update_data,
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            
            assert response.status_code in [200, 201]
        
        # Verify all recorded
        transactions = db_session.query(WalletTransaction)\
            .filter_by(wallet_id=user.wallet.id)\
            .all()
        
        assert len(transactions) >= 3


class TestE2EWalletWorkflow:
    """End-to-end wallet workflows"""
    
    def test_e2e_user_wallet_lifecycle(self, client, db_session, tenant_with_wallet):
        """E2E: Create wallet → Add points → Deduct points → View history"""
        user_token = tenant_with_wallet['user_token']
        admin_token = tenant_with_wallet['admin_token']
        user = tenant_with_wallet['user']
        
        # Step 1: View initial wallet
        response = client.get(
            "/wallets/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        initial_wallet = response.json()
        initial_balance = initial_wallet['current_balance']
        
        # Step 2: Admin adds points
        add_data = {
            "amount": 1000,
            "reason": "Signing bonus"
        }
        response = client.post(
            f"/wallets/user/{user.id}/add-points",
            json=add_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [200, 201]
        
        # Step 3: User deducts points
        deduct_data = {
            "amount": 250,
            "reason": "Redeemed rewards"
        }
        response = client.post(
            f"/wallets/user/{user.id}/deduct-points",
            json=deduct_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [200, 201]
        
        # Step 4: Verify final balance
        response = client.get(
            "/wallets/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        final_wallet = response.json()
        assert final_wallet['current_balance'] == initial_balance + 1000 - 250
        
        # Step 5: View transaction history
        response = client.get(
            "/wallets/me/transactions",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        transactions = response.json()
        assert len(transactions) >= 2  # At least add and deduct


# Fixtures
@pytest.fixture
def tenant_with_wallet(db_session, tenant):
    """Create tenant with user and wallet"""
    from core.security import create_access_token
    
    # Create admin user
    admin = User(
        tenant_id=tenant.id,
        corporate_email="admin@example.com",
        first_name="Admin",
        last_name="User",
        org_role="tenant_admin",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    # Create regular user
    user = User(
        tenant_id=tenant.id,
        corporate_email="user@example.com",
        first_name="Test",
        last_name="User",
        org_role="corporate_user",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    db_session.add_all([admin, user])
    db_session.flush()
    
    # Create wallets
    admin_wallet = Wallet(user_id=admin.id, tenant_id=tenant.id, current_balance=10000)
    user_wallet = Wallet(user_id=user.id, tenant_id=tenant.id, current_balance=5000)
    
    db_session.add_all([admin_wallet, user_wallet])
    db_session.commit()
    
    return {
        'admin': admin,
        'admin_token': create_access_token(user_id=str(admin.id)),
        'user': user,
        'user_token': create_access_token(user_id=str(user.id)),
        'tenant': tenant
    }


@pytest.fixture
def tenant_with_multiple_users(db_session, tenant):
    """Create tenant with multiple users"""
    from core.security import create_access_token
    
    admin = User(
        tenant_id=tenant.id,
        corporate_email="admin@example.com",
        first_name="Admin",
        last_name="User",
        org_role="tenant_admin",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    user1 = User(
        tenant_id=tenant.id,
        corporate_email="user1@example.com",
        first_name="User",
        last_name="One",
        org_role="corporate_user",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    user2 = User(
        tenant_id=tenant.id,
        corporate_email="user2@example.com",
        first_name="User",
        last_name="Two",
        org_role="corporate_user",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    db_session.add_all([admin, user1, user2])
    db_session.flush()
    
    wallet_admin = Wallet(user_id=admin.id, tenant_id=tenant.id, current_balance=10000)
    wallet1 = Wallet(user_id=user1.id, tenant_id=tenant.id, current_balance=5000)
    wallet2 = Wallet(user_id=user2.id, tenant_id=tenant.id, current_balance=5000)
    
    db_session.add_all([wallet_admin, wallet1, wallet2])
    db_session.commit()
    
    return {
        'admin': admin,
        'admin_token': create_access_token(user_id=str(admin.id)),
        'user': user1,
        'user1_token': create_access_token(user_id=str(user1.id)),
        'user2': user2,
        'user2_token': create_access_token(user_id=str(user2.id)),
        'tenant': tenant
    }
