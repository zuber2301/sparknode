"""
End-to-End Tests for Complete User Workflows
Tests full business processes from start to finish
"""
import pytest
import io
from fastapi.testclient import TestClient
from uuid import uuid4
from models import User, Recognition, Wallet, Ledger
from datetime import datetime


class TestE2EUserOnboarding:
    """E2E tests for complete user onboarding workflow"""
    
    def test_e2e_tenant_manager_invites_bulk_users(self, client, tenant_manager_token, db_session, tenant_with_department):
        """
        E2E: Tenant admin uploads CSV → Validates data → Confirms import → Users exist
        """
        csv_content = """email,full_name,department,role
john@example.com,John Doe,Engineering,corporate_user
jane@example.com,Jane Smith,Engineering,tenant_lead
bob@example.com,Bob Wilson,Engineering,corporate_user"""
        
        # Step 1: Upload CSV
        files = {'file': ('users.csv', io.BytesIO(csv_content.encode()), 'text/csv')}
        upload_response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert upload_response.status_code in [200, 201]
        batch_id = upload_response.json()['batch_id']
        
        # Step 2: Review staging data
        staging_response = client.get(
            f"/users/staging/{batch_id}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert staging_response.status_code == 200
        staging_rows = staging_response.json()
        assert len(staging_rows) == 3
        
        # Verify data was captured correctly
        emails = {row['raw_email'] for row in staging_rows}
        assert emails == {"john@example.com", "jane@example.com", "bob@example.com"}
        
        # Step 3: Confirm import
        confirm_response = client.post(
            f"/users/staging/{batch_id}/confirm",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert confirm_response.status_code in [200, 201]
        
        # Step 4: Verify users exist in system
        list_response = client.get(
            "/users",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert list_response.status_code == 200
        users = response.json()
        
        # At least our 3 new users should exist
        user_emails = {u['corporate_email'] for u in users if u.get('corporate_email')}
        assert "john@example.com" in user_emails
        assert "jane@example.com" in user_emails
        assert "bob@example.com" in user_emails
    
    def test_e2e_single_user_creation_flow(self, client, tenant_manager_token, db_session, tenant_with_department):
        """
        E2E: Admin creates single user → User is retrievable → User appears in lists
        """
        user_data = {
            "corporate_email": "newuser@example.com",
            "first_name": "New",
            "last_name": "User",
            "org_role": "tenant_lead",
            "password": "SecurePassword123!",
            "personal_email": "new.personal@example.com"
        }
        
        # Step 1: Create user
        create_response = client.post(
            "/users",
            json=user_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert create_response.status_code in [200, 201]
        created_user = create_response.json()
        user_id = created_user['id']
        
        # Step 2: Retrieve user by ID
        get_response = client.get(
            f"/users/{user_id}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert get_response.status_code == 200
        retrieved_user = get_response.json()
        assert retrieved_user['corporate_email'] == user_data['corporate_email']
        
        # Step 3: Verify user appears in list
        list_response = client.get(
            "/users",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert list_response.status_code == 200
        users = list_response.json()
        user_emails = {u.get('corporate_email') for u in users}
        assert user_data['corporate_email'] in user_emails


class TestE2ERecognitionFlow:
    """E2E tests for complete recognition workflows"""
    
    def test_e2e_user_recognizes_colleague(self, client, db_session, tenant_with_users):
        """
        E2E: User A recognizes User B → Recognition stored → Appears in feed
        """
        user_a = tenant_with_users['user_a']
        user_b = tenant_with_users['user_b']
        user_a_token = tenant_with_users['user_a_token']
        
        recognition_data = {
            "recipient_id": str(user_b.id),
            "message": "Great work on the project!",
            "achievement": "Leadership",
            "points": 100
        }
        
        # Step 1: User A gives recognition to User B
        recognition_response = client.post(
            "/recognitions",
            json=recognition_data,
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        assert recognition_response.status_code in [200, 201]
        recognition = recognition_response.json()
        recognition_id = recognition['id']
        
        # Step 2: Verify recognition is stored
        get_recognition_response = client.get(
            f"/recognitions/{recognition_id}",
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        assert get_recognition_response.status_code == 200
        stored_recognition = get_recognition_response.json()
        assert stored_recognition['message'] == recognition_data['message']
        assert stored_recognition['points'] == recognition_data['points']
        
        # Step 3: Verify points credited to User B's wallet
        user_b_wallet_response = client.get(
            "/wallets/my-wallet",
            headers={"Authorization": f"Bearer {tenant_with_users['user_b_token']}"}
        )
        assert user_b_wallet_response.status_code == 200
        wallet = user_b_wallet_response.json()
        assert wallet['current_balance'] >= recognition_data['points']


class TestE2ERedemptionFlow:
    """E2E tests for complete redemption workflows"""
    
    def test_e2e_user_redeems_voucher(self, client, db_session, tenant_with_users_and_budget):
        """
        E2E: Admin creates redemption voucher → User redeems → Points deducted
        """
        user = tenant_with_users_and_budget['user']
        user_token = tenant_with_users_and_budget['user_token']
        admin_token = tenant_with_users_and_budget['admin_token']
        
        # Ensure user has enough points
        wallet = db_session.query(Wallet).filter_by(user_id=user.id).first()
        wallet.current_balance = 500
        db_session.commit()
        
        voucher_data = {
            "title": "Coffee Voucher",
            "description": "Free coffee from café",
            "cost_points": 100,
            "quantity": 10,
            "expiry_days": 30
        }
        
        # Step 1: Admin creates voucher
        create_voucher_response = client.post(
            "/redemptions/vouchers",
            json=voucher_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_voucher_response.status_code in [200, 201]
        voucher = create_voucher_response.json()
        voucher_id = voucher['id']
        
        # Step 2: List available vouchers
        list_vouchers_response = client.get(
            "/redemptions/vouchers",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert list_vouchers_response.status_code == 200
        vouchers = list_vouchers_response.json()
        voucher_ids = {v['id'] for v in vouchers}
        assert voucher_id in voucher_ids
        
        # Step 3: User redeems voucher
        redeem_response = client.post(
            f"/redemptions/vouchers/{voucher_id}/redeem",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert redeem_response.status_code in [200, 201]
        redemption = redeem_response.json()
        assert redemption['status'] == "REDEEMED"
        
        # Step 4: Verify points were deducted
        updated_wallet_response = client.get(
            "/wallets/my-wallet",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert updated_wallet_response.status_code == 200
        updated_wallet = updated_wallet_response.json()
        assert updated_wallet['current_balance'] == 500 - voucher_data['cost_points']


class TestE2EDataIntegrity:
    """E2E tests for data integrity and consistency"""
    
    def test_e2e_tenant_isolation_complete_workflow(self, client, db_session, two_tenants_with_users):
        """
        E2E: Verify tenant1 data never leaks to tenant2 in complete workflow
        """
        tenant1 = two_tenants_with_users['tenant1']
        tenant2 = two_tenants_with_users['tenant2']
        
        user1_token = two_tenants_with_users['tenant1_user_token']
        user2_token = two_tenants_with_users['tenant2_user_token']
        
        # Step 1: Get users in tenant1
        tenant1_users_response = client.get(
            "/users",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert tenant1_users_response.status_code == 200
        tenant1_users = tenant1_users_response.json()
        tenant1_user_ids = {u['id'] for u in tenant1_users}
        
        # Step 2: Get users in tenant2
        tenant2_users_response = client.get(
            "/users",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert tenant2_users_response.status_code == 200
        tenant2_users = tenant2_users_response.json()
        tenant2_user_ids = {u['id'] for u in tenant2_users}
        
        # Step 3: Verify no overlap
        assert len(tenant1_user_ids & tenant2_user_ids) == 0, "Tenants should not share users"
        
        # Step 4: Tenant1 user cannot access tenant2 user's wallet
        if tenant2_users:
            tenant2_user_id = tenant2_users[0]['id']
            cross_tenant_response = client.get(
                f"/users/{tenant2_user_id}",
                headers={"Authorization": f"Bearer {user1_token}"}
            )
            assert cross_tenant_response.status_code == 403


class TestE2EErrorRecovery:
    """E2E tests for error handling and recovery"""
    
    def test_e2e_bulk_upload_partial_failure_recovery(self, client, tenant_manager_token, db_session, tenant_with_department):
        """
        E2E: Upload CSV with mix of valid/invalid data → Review errors → Fix and reupload
        """
        csv_with_errors = """email,full_name,department,role
valid@example.com,Valid User,Engineering,corporate_user
invalid-email,Invalid User,Engineering,user"""
        
        # Step 1: Upload CSV with errors
        files = {'file': ('users.csv', io.BytesIO(csv_with_errors.encode()), 'text/csv')}
        upload_response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert upload_response.status_code in [200, 201]
        batch_id = upload_response.json()['batch_id']
        
        # Step 2: Review staging data to find errors
        staging_response = client.get(
            f"/users/staging/{batch_id}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert staging_response.status_code == 200
        staging_rows = staging_response.json()
        
        # Find the error rows
        error_rows = [r for r in staging_rows if not r.get('is_valid')]
        assert len(error_rows) > 0, "Should have error rows"
        
        # Step 3: Re-upload with corrected data
        corrected_csv = """email,full_name,department,role
valid@example.com,Valid User,Engineering,corporate_user
fixed@example.com,Fixed User,Engineering,corporate_user"""
        
        files = {'file': ('users.csv', io.BytesIO(corrected_csv.encode()), 'text/csv')}
        retry_response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        assert retry_response.status_code in [200, 201]
        new_batch_id = retry_response.json()['batch_id']
        
        # Step 4: Verify new batch has fewer errors
        new_staging_response = client.get(
            f"/users/staging/{new_batch_id}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        new_staging_rows = new_staging_response.json()
        new_error_rows = [r for r in new_staging_rows if not r.get('is_valid')]
        
        assert len(new_error_rows) < len(error_rows), "Should have fewer errors after correction"


# Fixtures for E2E tests
@pytest.fixture
def tenant_with_users(db_session, tenant):
    """Create tenant with multiple users"""
    from auth.utils import get_password_hash
    
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
    db_session.commit()
    
    # Create wallets
    from models import Wallet
    wallet_a = Wallet(user_id=user_a.id, tenant_id=tenant.id, current_balance=1000)
    wallet_b = Wallet(user_id=user_b.id, tenant_id=tenant.id, current_balance=500)
    
    db_session.add_all([wallet_a, wallet_b])
    db_session.commit()
    
    return {
        'user_a': user_a,
        'user_b': user_b,
        'user_a_token': generate_test_token(user_a),
        'user_b_token': generate_test_token(user_b),
    }


@pytest.fixture
def tenant_with_users_and_budget(db_session, tenant_with_department):
    """Create tenant with users and budget"""
    from auth.utils import get_password_hash
    from models import Budget, Wallet
    
    user = User(
        tenant_id=tenant_with_department.id,
        corporate_email="user@example.com",
        first_name="Test",
        last_name="User",
        org_role="corporate_user",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    admin = User(
        tenant_id=tenant_with_department.id,
        corporate_email="admin@example.com",
        first_name="Admin",
        last_name="User",
        org_role="tenant_manager",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    db_session.add_all([user, admin])
    db_session.flush()
    
    wallet = Wallet(user_id=user.id, tenant_id=tenant_with_department.id, current_balance=500)
    db_session.add(wallet)
    
    budget = Budget(
        tenant_id=tenant_with_department.id,
        name="Test Budget",
        fiscal_year=2026,
        total_points=10000,
        status="active"
    )
    db_session.add(budget)
    db_session.commit()
    
    return {
        'user': user,
        'admin': admin,
        'user_token': generate_test_token(user),
        'admin_token': generate_test_token(admin),
    }


@pytest.fixture
def two_tenants_with_users(db_session):
    """Create two tenants with isolated users"""
    from auth.utils import get_password_hash
    from models import Wallet
    
    tenant1 = Tenant(
        name="Tenant 1",
        slug="tenant-1",
        domain="tenant1.example.com",
        admin_email="admin1@example.com",
        status="active"
    )
    
    tenant2 = Tenant(
        name="Tenant 2",
        slug="tenant-2",
        domain="tenant2.example.com",
        admin_email="admin2@example.com",
        status="active"
    )
    
    db_session.add_all([tenant1, tenant2])
    db_session.flush()
    
    user1 = User(
        tenant_id=tenant1.id,
        corporate_email="user1@tenant1.com",
        first_name="User",
        last_name="One",
        org_role="corporate_user",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    user2 = User(
        tenant_id=tenant2.id,
        corporate_email="user2@tenant2.com",
        first_name="User",
        last_name="Two",
        org_role="corporate_user",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    
    db_session.add_all([user1, user2])
    db_session.flush()
    
    wallet1 = Wallet(user_id=user1.id, tenant_id=tenant1.id)
    wallet2 = Wallet(user_id=user2.id, tenant_id=tenant2.id)
    
    db_session.add_all([wallet1, wallet2])
    db_session.commit()
    
    return {
        'tenant1': tenant1,
        'tenant2': tenant2,
        'tenant1_user_token': generate_test_token(user1),
        'tenant2_user_token': generate_test_token(user2),
    }


def generate_test_token(user):
    """Generate a test JWT token for a user"""
    from core.security import create_access_token
    return create_access_token(user_id=str(user.id))
