"""
Unit tests for AuditService

Tests all audit logging operations and convenience functions.
"""

import pytest
from uuid import uuid4
from unittest.mock import MagicMock, patch

# Import the service
from core.audit_service import AuditService, AuditActions, log_audit
from models import ActorType


class TestAuditService:
    """Test cases for AuditService class"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.mock_db = MagicMock()
        self.tenant_id = uuid4()
        self.actor_id = uuid4()
        self.entity_id = uuid4()
        
        # Create mock user
        self.mock_user = MagicMock()
        self.mock_user.id = self.actor_id
        self.mock_user.tenant_id = self.tenant_id
    
    # ==================== log_action tests ====================
    
    def test_log_action_basic(self):
        """Test basic audit log creation"""
        with patch('core.audit_service.AuditLog') as MockAuditLog:
            with patch('core.audit_service.append_impersonation_metadata', return_value={'key': 'value'}):
                mock_audit = MagicMock()
                MockAuditLog.return_value = mock_audit
                
                result = AuditService.log_action(
                    db=self.mock_db,
                    tenant_id=self.tenant_id,
                    actor_id=self.actor_id,
                    action='test_action',
                    entity_type='test_entity'
                )
                
                self.mock_db.add.assert_called_once_with(mock_audit)
                MockAuditLog.assert_called_once()
    
    def test_log_action_with_all_params(self):
        """Test audit log with all parameters"""
        old_values = {'status': 'active'}
        new_values = {'status': 'inactive'}
        
        with patch('core.audit_service.AuditLog') as MockAuditLog:
            with patch('core.audit_service.append_impersonation_metadata', return_value=new_values):
                mock_audit = MagicMock()
                MockAuditLog.return_value = mock_audit
                
                result = AuditService.log_action(
                    db=self.mock_db,
                    tenant_id=self.tenant_id,
                    actor_id=self.actor_id,
                    action=AuditActions.USER_UPDATED,
                    entity_type='user',
                    entity_id=self.entity_id,
                    old_values=old_values,
                    new_values=new_values,
                    ip_address='192.168.1.1',
                    actor_type=ActorType.USER
                )
                
                call_kwargs = MockAuditLog.call_args[1]
                assert call_kwargs['tenant_id'] == self.tenant_id
                assert call_kwargs['actor_id'] == self.actor_id
                assert call_kwargs['action'] == AuditActions.USER_UPDATED
                assert call_kwargs['entity_type'] == 'user'
                assert call_kwargs['entity_id'] == self.entity_id
                assert call_kwargs['ip_address'] == '192.168.1.1'
    
    def test_log_action_without_impersonation_metadata(self):
        """Test audit log without auto impersonation metadata"""
        new_values = {'points': 100}
        
        with patch('core.audit_service.AuditLog') as MockAuditLog:
            with patch('core.audit_service.append_impersonation_metadata') as mock_append:
                mock_audit = MagicMock()
                MockAuditLog.return_value = mock_audit
                
                AuditService.log_action(
                    db=self.mock_db,
                    tenant_id=self.tenant_id,
                    actor_id=self.actor_id,
                    action='test',
                    entity_type='test',
                    new_values=new_values,
                    auto_append_impersonation=False
                )
                
                # Should not call append_impersonation_metadata
                mock_append.assert_not_called()
    
    def test_log_action_defaults_empty_values(self):
        """Test that old_values and new_values default to empty dict"""
        with patch('core.audit_service.AuditLog') as MockAuditLog:
            mock_audit = MagicMock()
            MockAuditLog.return_value = mock_audit
            
            AuditService.log_action(
                db=self.mock_db,
                tenant_id=self.tenant_id,
                actor_id=self.actor_id,
                action='test',
                entity_type='test'
            )
            
            call_kwargs = MockAuditLog.call_args[1]
            assert call_kwargs['old_values'] == {}
            assert call_kwargs['new_values'] == {}
    
    # ==================== log_user_action tests ====================
    
    def test_log_user_action(self):
        """Test user action logging"""
        with patch('core.audit_service.AuditLog') as MockAuditLog:
            with patch('core.audit_service.append_impersonation_metadata', return_value={'data': 'test'}):
                mock_audit = MagicMock()
                MockAuditLog.return_value = mock_audit
                
                result = AuditService.log_user_action(
                    db=self.mock_db,
                    current_user=self.mock_user,
                    action=AuditActions.RECOGNITION_SENT,
                    entity_type='recognition',
                    entity_id=self.entity_id,
                    new_values={'data': 'test'}
                )
                
                # Should extract tenant_id from user
                call_kwargs = MockAuditLog.call_args[1]
                assert call_kwargs['tenant_id'] == self.mock_user.tenant_id
                assert call_kwargs['actor_id'] == self.mock_user.id
                assert call_kwargs['actor_type'] == ActorType.USER
    
    def test_log_user_action_with_ip(self):
        """Test user action with IP address"""
        with patch('core.audit_service.AuditLog') as MockAuditLog:
            mock_audit = MagicMock()
            MockAuditLog.return_value = mock_audit
            
            AuditService.log_user_action(
                db=self.mock_db,
                current_user=self.mock_user,
                action='login',
                entity_type='session',
                ip_address='10.0.0.1'
            )
            
            call_kwargs = MockAuditLog.call_args[1]
            assert call_kwargs['ip_address'] == '10.0.0.1'
    
    # ==================== log_system_action tests ====================
    
    def test_log_system_action(self):
        """Test system admin action logging"""
        admin_id = uuid4()
        
        with patch('core.audit_service.AuditLog') as MockAuditLog:
            mock_audit = MagicMock()
            MockAuditLog.return_value = mock_audit
            
            result = AuditService.log_system_action(
                db=self.mock_db,
                tenant_id=self.tenant_id,
                admin_id=admin_id,
                action=AuditActions.TENANT_SUSPENDED,
                entity_type='tenant',
                entity_id=self.tenant_id
            )
            
            call_kwargs = MockAuditLog.call_args[1]
            assert call_kwargs['actor_id'] == admin_id
            assert call_kwargs['actor_type'] == ActorType.SYSTEM_ADMIN
    
    def test_log_system_action_no_impersonation(self):
        """Test that system actions don't append impersonation metadata"""
        admin_id = uuid4()
        
        with patch('core.audit_service.AuditLog') as MockAuditLog:
            with patch('core.audit_service.append_impersonation_metadata') as mock_append:
                mock_audit = MagicMock()
                MockAuditLog.return_value = mock_audit
                
                # Even with new_values, should not call append_impersonation_metadata
                AuditService.log_system_action(
                    db=self.mock_db,
                    tenant_id=self.tenant_id,
                    admin_id=admin_id,
                    action='test',
                    entity_type='test',
                    new_values={'data': 'test'}
                )
                
                # auto_append_impersonation=False for system actions
                mock_append.assert_not_called()


class TestAuditActions:
    """Test AuditActions constants"""
    
    def test_user_actions_exist(self):
        """Test user action constants exist"""
        assert AuditActions.USER_CREATED == "user_created"
        assert AuditActions.USER_UPDATED == "user_updated"
        assert AuditActions.USER_DEACTIVATED == "user_deactivated"
        assert AuditActions.USER_REACTIVATED == "user_reactivated"
        assert AuditActions.USER_DELETED == "user_deleted"
        assert AuditActions.USER_BULK_UPLOAD == "user_bulk_upload"
    
    def test_wallet_actions_exist(self):
        """Test wallet action constants exist"""
        assert AuditActions.POINTS_ALLOCATED == "points_allocated"
        assert AuditActions.POINTS_ADJUSTED == "points_adjusted"
        assert AuditActions.POINTS_TRANSFERRED == "points_transferred"
    
    def test_recognition_actions_exist(self):
        """Test recognition action constants exist"""
        assert AuditActions.RECOGNITION_SENT == "recognition_sent"
        assert AuditActions.RECOGNITION_REVOKED == "recognition_revoked"
    
    def test_redemption_actions_exist(self):
        """Test redemption action constants exist"""
        assert AuditActions.REDEMPTION_CREATED == "redemption_created"
        assert AuditActions.REDEMPTION_PROCESSED == "redemption_processed"
        assert AuditActions.REDEMPTION_CANCELLED == "redemption_cancelled"
    
    def test_budget_actions_exist(self):
        """Test budget action constants exist"""
        assert AuditActions.BUDGET_CREATED == "budget_created"
        assert AuditActions.BUDGET_UPDATED == "budget_updated"
        assert AuditActions.BUDGET_ALLOCATED == "budget_allocated"
        assert AuditActions.LEAD_BUDGET_ALLOCATED == "lead_budget_allocated"
    
    def test_tenant_actions_exist(self):
        """Test tenant action constants exist"""
        assert AuditActions.TENANT_CREATED == "tenant_created"
        assert AuditActions.TENANT_UPDATED == "tenant_updated"
        assert AuditActions.TENANT_SUSPENDED == "tenant_suspended"
        assert AuditActions.TENANT_ACTIVATED == "tenant_activated"
    
    def test_event_actions_exist(self):
        """Test event action constants exist"""
        assert AuditActions.EVENT_CREATED == "event_created"
        assert AuditActions.EVENT_UPDATED == "event_updated"
        assert AuditActions.EVENT_PUBLISHED == "event_published"
        assert AuditActions.EVENT_CANCELLED == "event_cancelled"
        assert AuditActions.NOMINATION_CREATED == "nomination_created"
        assert AuditActions.NOMINATION_APPROVED == "nomination_approved"
        assert AuditActions.NOMINATION_REJECTED == "nomination_rejected"


class TestLogAuditConvenienceFunction:
    """Test the log_audit convenience function"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.mock_db = MagicMock()
        self.mock_user = MagicMock()
        self.mock_user.id = uuid4()
        self.mock_user.tenant_id = uuid4()
    
    def test_log_audit_calls_service(self):
        """Test that log_audit calls AuditService.log_user_action"""
        entity_id = uuid4()
        
        with patch.object(AuditService, 'log_user_action') as mock_log:
            mock_audit = MagicMock()
            mock_log.return_value = mock_audit
            
            result = log_audit(
                db=self.mock_db,
                current_user=self.mock_user,
                action=AuditActions.POINTS_ALLOCATED,
                entity_type='wallet',
                entity_id=entity_id,
                old_values={'balance': 100},
                new_values={'balance': 150}
            )
            
            mock_log.assert_called_once_with(
                db=self.mock_db,
                current_user=self.mock_user,
                action=AuditActions.POINTS_ALLOCATED,
                entity_type='wallet',
                entity_id=entity_id,
                old_values={'balance': 100},
                new_values={'balance': 150}
            )
    
    def test_log_audit_minimal_params(self):
        """Test log_audit with minimal parameters"""
        with patch.object(AuditService, 'log_user_action') as mock_log:
            mock_audit = MagicMock()
            mock_log.return_value = mock_audit
            
            log_audit(
                db=self.mock_db,
                current_user=self.mock_user,
                action='test',
                entity_type='test'
            )
            
            mock_log.assert_called_once()
            call_kwargs = mock_log.call_args[1]
            assert call_kwargs['entity_id'] is None
            assert call_kwargs['old_values'] is None
            assert call_kwargs['new_values'] is None


class TestIntegrationScenarios:
    """Test realistic usage scenarios"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.mock_db = MagicMock()
        self.mock_user = MagicMock()
        self.mock_user.id = uuid4()
        self.mock_user.tenant_id = uuid4()
    
    def test_user_creation_audit(self):
        """Test auditing a user creation"""
        new_user_id = uuid4()
        
        with patch('core.audit_service.AuditLog') as MockAuditLog:
            with patch('core.audit_service.append_impersonation_metadata', side_effect=lambda x: x):
                mock_audit = MagicMock()
                MockAuditLog.return_value = mock_audit
                
                AuditService.log_user_action(
                    db=self.mock_db,
                    current_user=self.mock_user,
                    action=AuditActions.USER_CREATED,
                    entity_type='user',
                    entity_id=new_user_id,
                    new_values={
                        'email': 'newuser@example.com',
                        'first_name': 'John',
                        'last_name': 'Doe',
                        'department': 'Engineering'
                    }
                )
                
                call_kwargs = MockAuditLog.call_args[1]
                assert call_kwargs['action'] == AuditActions.USER_CREATED
                assert 'email' in call_kwargs['new_values']
    
    def test_points_allocation_audit(self):
        """Test auditing a points allocation"""
        wallet_id = uuid4()
        
        with patch('core.audit_service.AuditLog') as MockAuditLog:
            with patch('core.audit_service.append_impersonation_metadata', side_effect=lambda x: x):
                mock_audit = MagicMock()
                MockAuditLog.return_value = mock_audit
                
                AuditService.log_user_action(
                    db=self.mock_db,
                    current_user=self.mock_user,
                    action=AuditActions.POINTS_ALLOCATED,
                    entity_type='wallet',
                    entity_id=wallet_id,
                    old_values={'balance': '100.00'},
                    new_values={'balance': '150.00', 'points_added': '50.00'}
                )
                
                call_kwargs = MockAuditLog.call_args[1]
                assert call_kwargs['action'] == AuditActions.POINTS_ALLOCATED
                assert call_kwargs['old_values']['balance'] == '100.00'
                assert call_kwargs['new_values']['balance'] == '150.00'
    
    def test_tenant_suspension_by_admin(self):
        """Test auditing a tenant suspension by system admin"""
        admin_id = uuid4()
        tenant_id = uuid4()
        
        with patch('core.audit_service.AuditLog') as MockAuditLog:
            mock_audit = MagicMock()
            MockAuditLog.return_value = mock_audit
            
            AuditService.log_system_action(
                db=self.mock_db,
                tenant_id=tenant_id,
                admin_id=admin_id,
                action=AuditActions.TENANT_SUSPENDED,
                entity_type='tenant',
                entity_id=tenant_id,
                old_values={'status': 'active'},
                new_values={'status': 'suspended', 'reason': 'Non-payment'}
            )
            
            call_kwargs = MockAuditLog.call_args[1]
            assert call_kwargs['actor_type'] == ActorType.SYSTEM_ADMIN
            assert call_kwargs['action'] == AuditActions.TENANT_SUSPENDED
