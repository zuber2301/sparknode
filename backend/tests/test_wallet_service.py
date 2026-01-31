"""
Unit tests for WalletService

Tests all wallet operations including credits, debits, and audit logging.
"""

import pytest
from decimal import Decimal
from uuid import uuid4
from unittest.mock import MagicMock, patch

# Import the service
from core.wallet_service import WalletService, credit_user_wallet, debit_user_wallet


class TestWalletService:
    """Test cases for WalletService class"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.mock_db = MagicMock()
        self.tenant_id = uuid4()
        self.user_id = uuid4()
        
        # Create mock user
        self.mock_user = MagicMock()
        self.mock_user.id = self.user_id
        self.mock_user.tenant_id = self.tenant_id
        
        # Create mock wallet
        self.mock_wallet = MagicMock()
        self.mock_wallet.id = uuid4()
        self.mock_wallet.tenant_id = self.tenant_id
        self.mock_wallet.user_id = self.user_id
        self.mock_wallet.balance = Decimal('100.00')
        self.mock_wallet.lifetime_earned = Decimal('500.00')
        self.mock_wallet.lifetime_spent = Decimal('400.00')
    
    # ==================== get_or_create_wallet tests ====================
    
    def test_get_or_create_wallet_existing(self):
        """Test getting an existing wallet"""
        self.mock_db.query.return_value.filter.return_value.first.return_value = self.mock_wallet
        
        result = WalletService.get_or_create_wallet(self.mock_db, self.mock_user)
        
        assert result == self.mock_wallet
        self.mock_db.add.assert_not_called()
    
    def test_get_or_create_wallet_new(self):
        """Test creating a new wallet when none exists"""
        self.mock_db.query.return_value.filter.return_value.first.return_value = None
        
        with patch('core.wallet_service.Wallet') as MockWallet:
            mock_new_wallet = MagicMock()
            MockWallet.return_value = mock_new_wallet
            
            result = WalletService.get_or_create_wallet(self.mock_db, self.mock_user)
            
            self.mock_db.add.assert_called_once_with(mock_new_wallet)
            self.mock_db.flush.assert_called_once()
    
    # ==================== credit_wallet tests ====================
    
    def test_credit_wallet_success(self):
        """Test successful credit to wallet"""
        with patch('core.wallet_service.WalletLedger') as MockLedger:
            mock_ledger = MagicMock()
            MockLedger.return_value = mock_ledger
            
            ledger_entry, new_balance = WalletService.credit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('50.00'),
                source='hr_allocation',
                description='Test credit',
                created_by=self.user_id
            )
            
            assert new_balance == Decimal('150.00')
            assert self.mock_wallet.balance == Decimal('150.00')
            assert self.mock_wallet.lifetime_earned == Decimal('550.00')
            self.mock_db.add.assert_called_once()
    
    def test_credit_wallet_string_points(self):
        """Test credit with string points value"""
        with patch('core.wallet_service.WalletLedger'):
            ledger_entry, new_balance = WalletService.credit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points='25.50',  # String value
                source='recognition'
            )
            
            assert new_balance == Decimal('125.50')
    
    def test_credit_wallet_zero_points_error(self):
        """Test credit with zero points raises error"""
        with pytest.raises(ValueError, match="Credit amount must be positive"):
            WalletService.credit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('0'),
                source='test'
            )
    
    def test_credit_wallet_negative_points_error(self):
        """Test credit with negative points raises error"""
        with pytest.raises(ValueError, match="Credit amount must be positive"):
            WalletService.credit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('-10'),
                source='test'
            )
    
    def test_credit_wallet_with_reference(self):
        """Test credit with reference type and id"""
        reference_id = uuid4()
        
        with patch('core.wallet_service.WalletLedger') as MockLedger:
            WalletService.credit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('100'),
                source='recognition',
                reference_type='recognition',
                reference_id=reference_id
            )
            
            # Verify ledger was created with reference
            call_kwargs = MockLedger.call_args[1]
            assert call_kwargs['reference_type'] == 'recognition'
            assert call_kwargs['reference_id'] == reference_id
    
    # ==================== debit_wallet tests ====================
    
    def test_debit_wallet_success(self):
        """Test successful debit from wallet"""
        with patch('core.wallet_service.WalletLedger') as MockLedger:
            mock_ledger = MagicMock()
            MockLedger.return_value = mock_ledger
            
            ledger_entry, new_balance = WalletService.debit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('30.00'),
                source='redemption',
                description='Test debit'
            )
            
            assert new_balance == Decimal('70.00')
            assert self.mock_wallet.balance == Decimal('70.00')
            assert self.mock_wallet.lifetime_spent == Decimal('430.00')
    
    def test_debit_wallet_insufficient_balance_error(self):
        """Test debit with insufficient balance raises error"""
        with pytest.raises(ValueError, match="Insufficient balance"):
            WalletService.debit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('200.00'),  # More than balance of 100
                source='redemption'
            )
    
    def test_debit_wallet_allow_negative(self):
        """Test debit allowing negative balance"""
        with patch('core.wallet_service.WalletLedger'):
            ledger_entry, new_balance = WalletService.debit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('200.00'),
                source='adjustment',
                allow_negative=True
            )
            
            assert new_balance == Decimal('-100.00')
    
    def test_debit_wallet_zero_points_error(self):
        """Test debit with zero points raises error"""
        with pytest.raises(ValueError, match="Debit amount must be positive"):
            WalletService.debit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('0'),
                source='test'
            )
    
    def test_debit_wallet_exact_balance(self):
        """Test debit of exact balance amount"""
        with patch('core.wallet_service.WalletLedger'):
            ledger_entry, new_balance = WalletService.debit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('100.00'),  # Exact balance
                source='redemption'
            )
            
            assert new_balance == Decimal('0.00')
    
    # ==================== log_wallet_action tests ====================
    
    def test_log_wallet_action(self):
        """Test audit log creation for wallet action"""
        with patch('core.wallet_service.AuditLog') as MockAudit:
            with patch('core.wallet_service.append_impersonation_metadata', return_value={'balance': '150', 'points': '50'}):
                mock_audit = MagicMock()
                MockAudit.return_value = mock_audit
                
                result = WalletService.log_wallet_action(
                    db=self.mock_db,
                    wallet=self.mock_wallet,
                    actor_id=self.user_id,
                    action='points_allocated',
                    old_balance=Decimal('100'),
                    new_balance=Decimal('150'),
                    points=Decimal('50')
                )
                
                self.mock_db.add.assert_called_once_with(mock_audit)
                MockAudit.assert_called_once()
    
    def test_log_wallet_action_with_extra_data(self):
        """Test audit log with extra data"""
        with patch('core.wallet_service.AuditLog') as MockAudit:
            with patch('core.wallet_service.append_impersonation_metadata') as mock_append:
                mock_append.return_value = {'balance': '150', 'points': '50', 'source': 'recognition'}
                
                WalletService.log_wallet_action(
                    db=self.mock_db,
                    wallet=self.mock_wallet,
                    actor_id=self.user_id,
                    action='recognition',
                    old_balance=Decimal('100'),
                    new_balance=Decimal('150'),
                    points=Decimal('50'),
                    extra_data={'source': 'recognition', 'from_user': 'John'}
                )
                
                # Verify extra_data was included
                call_args = mock_append.call_args[0][0]
                assert 'source' in call_args
                assert 'from_user' in call_args


class TestConvenienceFunctions:
    """Test cases for convenience functions"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.mock_db = MagicMock()
        self.tenant_id = uuid4()
        self.user_id = uuid4()
        
        self.mock_user = MagicMock()
        self.mock_user.id = self.user_id
        self.mock_user.tenant_id = self.tenant_id
        
        self.mock_wallet = MagicMock()
        self.mock_wallet.id = uuid4()
        self.mock_wallet.tenant_id = self.tenant_id
        self.mock_wallet.user_id = self.user_id
        self.mock_wallet.balance = Decimal('100.00')
        self.mock_wallet.lifetime_earned = Decimal('500.00')
        self.mock_wallet.lifetime_spent = Decimal('400.00')
    
    def test_credit_user_wallet(self):
        """Test credit_user_wallet convenience function"""
        with patch.object(WalletService, 'get_or_create_wallet', return_value=self.mock_wallet):
            with patch.object(WalletService, 'credit_wallet') as mock_credit:
                mock_credit.return_value = (MagicMock(), Decimal('150.00'))
                
                result = credit_user_wallet(
                    db=self.mock_db,
                    user=self.mock_user,
                    points=Decimal('50'),
                    source='hr_allocation',
                    created_by=self.user_id
                )
                
                mock_credit.assert_called_once()
    
    def test_debit_user_wallet(self):
        """Test debit_user_wallet convenience function"""
        self.mock_db.query.return_value.filter.return_value.first.return_value = self.mock_wallet
        
        with patch.object(WalletService, 'debit_wallet') as mock_debit:
            mock_debit.return_value = (MagicMock(), Decimal('50.00'))
            
            result = debit_user_wallet(
                db=self.mock_db,
                user=self.mock_user,
                points=Decimal('50'),
                source='redemption',
                created_by=self.user_id
            )
            
            mock_debit.assert_called_once()


class TestEdgeCases:
    """Test edge cases and boundary conditions"""
    
    def setup_method(self):
        self.mock_db = MagicMock()
        self.mock_wallet = MagicMock()
        self.mock_wallet.id = uuid4()
        self.mock_wallet.tenant_id = uuid4()
        self.mock_wallet.balance = Decimal('0.01')  # Very small balance
        self.mock_wallet.lifetime_earned = Decimal('0')
        self.mock_wallet.lifetime_spent = Decimal('0')
    
    def test_credit_very_small_amount(self):
        """Test credit with very small amount"""
        with patch('core.wallet_service.WalletLedger'):
            ledger_entry, new_balance = WalletService.credit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('0.01'),
                source='test'
            )
            
            assert new_balance == Decimal('0.02')
    
    def test_credit_very_large_amount(self):
        """Test credit with very large amount"""
        with patch('core.wallet_service.WalletLedger'):
            ledger_entry, new_balance = WalletService.credit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('999999999.99'),
                source='test'
            )
            
            assert new_balance == Decimal('999999999.99') + Decimal('0.01')
    
    def test_debit_penny(self):
        """Test debit of smallest possible amount"""
        with patch('core.wallet_service.WalletLedger'):
            ledger_entry, new_balance = WalletService.debit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('0.01'),
                source='test'
            )
            
            assert new_balance == Decimal('0.00')
    
    def test_decimal_precision(self):
        """Test that decimal precision is maintained"""
        self.mock_wallet.balance = Decimal('100.123456789')
        self.mock_wallet.lifetime_earned = Decimal('0')
        
        with patch('core.wallet_service.WalletLedger'):
            ledger_entry, new_balance = WalletService.credit_wallet(
                db=self.mock_db,
                wallet=self.mock_wallet,
                points=Decimal('0.000000001'),
                source='test'
            )
            
            # Should maintain precision
            assert new_balance == Decimal('100.123456790')
