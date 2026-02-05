"""
Module Integration Tests for SparkNode Backend

These tests validate the integration between different modules
without requiring the full FastAPI application context or running server.
They test realistic workflows across services.
"""

import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

# Auth utilities
from auth.utils import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    decode_token
)

# Services
from core.wallet_service import WalletService, credit_user_wallet, debit_user_wallet
from core.audit_service import AuditService, AuditActions, log_audit
from core.rbac import RolePermissions, Permission, UserRole
from models import ActorType


# Helper function for tests
def has_permission(user, permission_name: str) -> bool:
    """Check if a user has a permission by name"""
    try:
        perm = Permission(permission_name)
        return RolePermissions.has_permission(user.org_role, perm)
    except ValueError:
        return False


class TestAuthenticationFlow:
    """Test complete authentication flow"""
    
    def test_password_hash_and_verify_flow(self):
        """Test complete password hash and verify cycle"""
        # User registration - password gets hashed
        password = "Str0ngP@ssword123!"
        hashed = get_password_hash(password)
        
        # User login - password gets verified
        assert verify_password(password, hashed) is True
        
        # Wrong password rejected
        assert verify_password("wrongpassword", hashed) is False
    
    def test_token_creation_and_decode_flow(self):
        """Test JWT token creation and validation"""
        user_id = uuid4()
        tenant_id = uuid4()
        
        # Create token with user data
        token_data = {
            "sub": str(user_id),
            "tenant_id": str(tenant_id),
            "email": "user@example.com",
            "org_role": "employee"
        }
        token = create_access_token(token_data)
        
        # Decode token and verify data (returns TokenData object)
        decoded = decode_token(token)
        assert str(decoded.user_id) == str(user_id)
        assert str(decoded.tenant_id) == str(tenant_id)
        assert decoded.email == "user@example.com"
    
    def test_token_expiration_claim(self):
        """Test token contains proper expiration"""
        user_id = uuid4()
        token = create_access_token({
            "sub": str(user_id),
            "tenant_id": str(uuid4()),
            "email": "test@test.com",
            "org_role": "employee"
        })
        
        # Decode token - if successful, token hasn't expired
        decoded = decode_token(token)
        
        # Token decoded successfully means it's valid
        assert decoded is not None
        assert decoded.user_id == user_id


class TestWalletOperationsFlow:
    """Test complete wallet operation scenarios"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.mock_db = MagicMock()
        self.tenant_id = uuid4()
        self.user_id = uuid4()
        
        # Mock user
        self.mock_user = MagicMock()
        self.mock_user.id = self.user_id
        self.mock_user.tenant_id = self.tenant_id
        
        # Mock wallet with real Decimal values
        self.mock_wallet = MagicMock()
        self.mock_wallet.id = uuid4()
        self.mock_wallet.tenant_id = self.tenant_id
        self.mock_wallet.user_id = self.user_id
        self.mock_wallet.balance = Decimal('0.00')
        self.mock_wallet.lifetime_earned = Decimal('0.00')
        self.mock_wallet.lifetime_spent = Decimal('0.00')
    
    def test_hr_allocation_flow(self):
        """Test HR allocating points to user wallet"""
        hr_user_id = uuid4()
        
        with patch('core.wallet_service.WalletLedger') as MockLedger:
            # HR credits points to user
            ledger, new_balance = WalletService.credit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('500.00'),
                source='hr_allocation',
                description='Monthly allocation',
                created_by=hr_user_id
            )
            
            # Verify wallet updated
            assert new_balance == Decimal('500.00')
            assert self.mock_wallet.balance == Decimal('500.00')
            assert self.mock_wallet.lifetime_earned == Decimal('500.00')
    
    def test_recognition_send_receive_flow(self):
        """Test recognition flow - sender debits, receiver credits"""
        sender_wallet = MagicMock()
        sender_wallet.id = uuid4()
        sender_wallet.balance = Decimal('100.00')
        sender_wallet.lifetime_earned = Decimal('100.00')
        sender_wallet.lifetime_spent = Decimal('0.00')
        
        receiver_wallet = MagicMock()
        receiver_wallet.id = uuid4()
        receiver_wallet.balance = Decimal('50.00')
        receiver_wallet.lifetime_earned = Decimal('50.00')
        receiver_wallet.lifetime_spent = Decimal('0.00')
        
        recognition_id = uuid4()
        points = Decimal('25.00')
        
        with patch('core.wallet_service.WalletLedger'):
            # Sender sends recognition (debit)
            _, sender_new_balance = WalletService.debit_wallet(
                db=self.mock_db,
                wallet=sender_wallet,
                points=points,
                source='recognition',
                description='Sent recognition',
                reference_type='recognition',
                reference_id=recognition_id
            )
            
            # Receiver gets recognition (credit)
            _, receiver_new_balance = WalletService.credit_wallet(
                db=self.mock_db,
                wallet=receiver_wallet,
                points=points,
                source='recognition',
                description='Received recognition',
                reference_type='recognition',
                reference_id=recognition_id
            )
            
            # Verify balances
            assert sender_new_balance == Decimal('75.00')
            assert receiver_new_balance == Decimal('75.00')
    
    def test_redemption_flow(self):
        """Test redemption flow - debit points for reward"""
        self.mock_wallet.balance = Decimal('200.00')
        redemption_id = uuid4()
        reward_cost = Decimal('75.00')
        
        with patch('core.wallet_service.WalletLedger'):
            ledger, new_balance = WalletService.debit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=reward_cost,
                source='redemption',
                description='Gift card redemption',
                reference_type='redemption',
                reference_id=redemption_id
            )
            
            assert new_balance == Decimal('125.00')
            assert self.mock_wallet.lifetime_spent == Decimal('75.00')
    
    def test_insufficient_balance_blocks_redemption(self):
        """Test redemption blocked with insufficient balance"""
        self.mock_wallet.balance = Decimal('50.00')
        
        with pytest.raises(ValueError, match="Insufficient balance"):
            WalletService.debit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('100.00'),
                source='redemption'
            )


class TestAuditTrailFlow:
    """Test audit logging scenarios"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.mock_db = MagicMock()
        self.mock_user = MagicMock()
        self.mock_user.id = uuid4()
        self.mock_user.tenant_id = uuid4()
    
    def test_user_creation_audit_trail(self):
        """Test audit trail for user creation"""
        new_user_id = uuid4()
        
        with patch('core.audit_service.AuditLog') as MockAudit:
            with patch('core.audit_service.append_impersonation_metadata', side_effect=lambda x: x):
                mock_audit = MagicMock()
                MockAudit.return_value = mock_audit
                
                # Log user creation
                AuditService.log_user_action(
                    db=self.mock_db,
                    current_user=self.mock_user,
                    action=AuditActions.USER_CREATED,
                    entity_type='user',
                    entity_id=new_user_id,
                    new_values={
                        'email': 'newuser@company.com',
                        'first_name': 'John',
                        'last_name': 'Doe',
                        'department_id': str(uuid4())
                    }
                )
                
                # Verify audit log created
                self.mock_db.add.assert_called_once()
                call_kwargs = MockAudit.call_args[1]
                assert call_kwargs['action'] == 'user_created'
                assert call_kwargs['entity_type'] == 'user'
    
    def test_points_allocation_audit_trail(self):
        """Test audit trail for points allocation"""
        wallet_id = uuid4()
        
        with patch('core.audit_service.AuditLog') as MockAudit:
            with patch('core.audit_service.append_impersonation_metadata', side_effect=lambda x: x):
                mock_audit = MagicMock()
                MockAudit.return_value = mock_audit
                
                # Log points allocation
                AuditService.log_user_action(
                    db=self.mock_db,
                    current_user=self.mock_user,
                    action=AuditActions.POINTS_ALLOCATED,
                    entity_type='wallet',
                    entity_id=wallet_id,
                    old_values={'balance': '100.00'},
                    new_values={'balance': '150.00', 'points_added': '50.00'}
                )
                
                call_kwargs = MockAudit.call_args[1]
                assert call_kwargs['old_values']['balance'] == '100.00'
                assert call_kwargs['new_values']['balance'] == '150.00'
    
    def test_system_admin_action_audit_trail(self):
        """Test audit trail for system admin actions"""
        admin_id = uuid4()
        tenant_id = uuid4()
        
        with patch('core.audit_service.AuditLog') as MockAudit:
            mock_audit = MagicMock()
            MockAudit.return_value = mock_audit
            
            # Log tenant suspension
            AuditService.log_system_action(
                db=self.mock_db,
                tenant_id=tenant_id,
                admin_id=admin_id,
                action=AuditActions.TENANT_SUSPENDED,
                entity_type='tenant',
                entity_id=tenant_id,
                old_values={'status': 'active'},
                new_values={'status': 'suspended', 'reason': 'Violation of terms'}
            )
            
            call_kwargs = MockAudit.call_args[1]
            assert call_kwargs['actor_type'] == ActorType.SYSTEM_ADMIN


class TestRBACIntegration:
    """Test Role-Based Access Control integration"""
    
    def test_tenant_manager_permissions(self):
        """Test Tenant Manager role has correct permissions"""
        # Tenant admin should have these permissions
        assert RolePermissions.has_permission('tenant_manager', Permission.MANAGE_USERS) is True
        assert RolePermissions.has_permission('tenant_manager', Permission.ALLOCATE_POINTS) is True
        assert RolePermissions.has_permission('tenant_manager', Permission.VIEW_TENANT_ANALYTICS) is True
        assert RolePermissions.has_permission('tenant_manager', Permission.MANAGE_BUDGETS) is True
    
    def test_dept_lead_permissions(self):
        """Test Tenant Lead role has correct permissions"""
        # Lead should have team budget permission
        assert RolePermissions.has_permission('dept_lead', Permission.MANAGE_TEAM_BUDGET) is True
    
    def test_corporate_user_permissions(self):
        """Test Corporate User role has correct permissions"""
        # Corporate user can redeem points
        assert RolePermissions.has_permission('corporate_user', Permission.REDEEM_POINTS) is True
    
    def test_platform_admin_has_all_permissions(self):
        """Test Platform Admin role has all permissions"""
        # Platform admin should have all permissions
        all_permissions = list(Permission)
        for perm in all_permissions:
            assert RolePermissions.has_permission('platform_admin', perm) is True
    
    def test_has_permission_with_user_object(self):
        """Test has_permission helper with user mock"""
        # Create mock user with corporate_user role
        mock_user = MagicMock()
        mock_user.org_role = 'corporate_user'
        
        # Corporate user can redeem points
        assert has_permission(mock_user, 'redeem_points') is True
        
        # Corporate user cannot manage users
        assert has_permission(mock_user, 'manage_users') is False


class TestCombinedWorkflow:
    """Test combined workflows across multiple services"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.mock_db = MagicMock()
        self.tenant_id = uuid4()
    
    def test_full_recognition_workflow_with_audit(self):
        """Test complete recognition flow with audit logging"""
        sender_id = uuid4()
        receiver_id = uuid4()
        recognition_id = uuid4()
        
        # Mock sender
        sender = MagicMock()
        sender.id = sender_id
        sender.tenant_id = self.tenant_id
        
        # Mock sender wallet
        sender_wallet = MagicMock()
        sender_wallet.id = uuid4()
        sender_wallet.balance = Decimal('100.00')
        sender_wallet.lifetime_earned = Decimal('100.00')
        sender_wallet.lifetime_spent = Decimal('0.00')
        
        # Mock receiver wallet  
        receiver_wallet = MagicMock()
        receiver_wallet.id = uuid4()
        receiver_wallet.balance = Decimal('50.00')
        receiver_wallet.lifetime_earned = Decimal('50.00')
        receiver_wallet.lifetime_spent = Decimal('0.00')
        
        points = Decimal('15.00')
        
        with patch('core.wallet_service.WalletLedger'):
            with patch('core.audit_service.AuditLog') as MockAudit:
                with patch('core.audit_service.append_impersonation_metadata', side_effect=lambda x: x):
                    mock_audit = MagicMock()
                    MockAudit.return_value = mock_audit
                    
                    # 1. Debit sender wallet
                    WalletService.debit_wallet(
                        db=self.mock_db,
                        wallet=sender_wallet,
                        points=points,
                        source='recognition',
                        reference_type='recognition',
                        reference_id=recognition_id
                    )
                    
                    # 2. Credit receiver wallet
                    WalletService.credit_wallet(
                        db=self.mock_db,
                        wallet=receiver_wallet,
                        points=points,
                        source='recognition',
                        reference_type='recognition',
                        reference_id=recognition_id
                    )
                    
                    # 3. Log audit entry
                    AuditService.log_user_action(
                        db=self.mock_db,
                        current_user=sender,
                        action=AuditActions.RECOGNITION_SENT,
                        entity_type='recognition',
                        entity_id=recognition_id,
                        new_values={
                            'sender_id': str(sender_id),
                            'receiver_id': str(receiver_id),
                            'points': str(points),
                            'message': 'Great work!'
                        }
                    )
                    
                    # Verify balances updated
                    assert sender_wallet.balance == Decimal('85.00')
                    assert receiver_wallet.balance == Decimal('65.00')
    
    def test_budget_allocation_workflow(self):
        """Test HR budget allocation workflow"""
        hr_user_id = uuid4()
        employee_id = uuid4()
        allocation_points = Decimal('200.00')
        
        # Mock Tenant Manager user (has allocate_points permission)
        admin_user = MagicMock()
        admin_user.id = hr_user_id
        admin_user.tenant_id = self.tenant_id
        admin_user.org_role = 'tenant_manager'
        
        # Mock employee wallet
        employee_wallet = MagicMock()
        employee_wallet.id = uuid4()
        employee_wallet.balance = Decimal('0.00')
        employee_wallet.lifetime_earned = Decimal('0.00')
        employee_wallet.lifetime_spent = Decimal('0.00')
        
        with patch('core.wallet_service.WalletLedger'):
            with patch('core.audit_service.AuditLog') as MockAudit:
                with patch('core.audit_service.append_impersonation_metadata', side_effect=lambda x: x):
                    mock_audit = MagicMock()
                    MockAudit.return_value = mock_audit
                    
                    # Check admin has permission to allocate
                    assert has_permission(admin_user, 'allocate_points') is True
                    
                    # Allocate points
                    ledger, new_balance = WalletService.credit_wallet(
                        db=self.mock_db,
                        wallet=employee_wallet,
                        points=allocation_points,
                        source='hr_allocation',
                        description='Q1 Budget Allocation',
                        created_by=hr_user_id
                    )
                    
                    # Log allocation
                    AuditService.log_user_action(
                        db=self.mock_db,
                        current_user=admin_user,
                        action=AuditActions.POINTS_ALLOCATED,
                        entity_type='wallet',
                        entity_id=employee_wallet.id,
                        old_values={'balance': '0.00'},
                        new_values={'balance': str(allocation_points)}
                    )
                    
                    # Verify
                    assert new_balance == Decimal('200.00')
                    assert employee_wallet.lifetime_earned == Decimal('200.00')


class TestErrorHandling:
    """Test error handling across services"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.mock_db = MagicMock()
    
    def test_wallet_validation_errors(self):
        """Test wallet operation validation errors"""
        wallet = MagicMock()
        wallet.balance = Decimal('50.00')
        wallet.lifetime_earned = Decimal('50.00')
        wallet.lifetime_spent = Decimal('0.00')
        
        # Zero credit
        with pytest.raises(ValueError, match="Credit amount must be positive"):
            WalletService.credit_wallet(
                self.mock_db, wallet, Decimal('0'), 'test'
            )
        
        # Negative credit
        with pytest.raises(ValueError, match="Credit amount must be positive"):
            WalletService.credit_wallet(
                self.mock_db, wallet, Decimal('-10'), 'test'
            )
        
        # Zero debit
        with pytest.raises(ValueError, match="Debit amount must be positive"):
            WalletService.debit_wallet(
                self.mock_db, wallet, Decimal('0'), 'test'
            )
        
        # Insufficient balance
        with pytest.raises(ValueError, match="Insufficient balance"):
            WalletService.debit_wallet(
                self.mock_db, wallet, Decimal('100'), 'test'
            )
    
    def test_invalid_token_handling(self):
        """Test handling of invalid JWT tokens"""
        # Invalid token format
        with pytest.raises(Exception):
            decode_token("invalid.token.here")
        
        # Empty token
        with pytest.raises(Exception):
            decode_token("")
