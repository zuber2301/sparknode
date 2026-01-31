"""
Wallet Service

Reusable service for wallet operations including credits, debits, and ledger entries.
This centralizes all wallet-related logic to avoid code duplication across routes.
"""

from decimal import Decimal
from uuid import UUID
from sqlalchemy.orm import Session
from typing import Optional, Tuple

from models import Wallet, WalletLedger, AuditLog, User
from core import append_impersonation_metadata


class WalletService:
    """Service class for wallet operations"""
    
    @staticmethod
    def get_or_create_wallet(db: Session, user: User) -> Wallet:
        """
        Get a user's wallet or create one if it doesn't exist.
        
        Args:
            db: Database session
            user: User object
            
        Returns:
            Wallet object
        """
        wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
        if not wallet:
            wallet = Wallet(
                tenant_id=user.tenant_id,
                user_id=user.id,
                balance=Decimal('0'),
                lifetime_earned=Decimal('0'),
                lifetime_spent=Decimal('0')
            )
            db.add(wallet)
            db.flush()
        return wallet
    
    @staticmethod
    def credit_wallet(
        db: Session,
        wallet: Wallet,
        points: Decimal,
        source: str,
        description: Optional[str] = None,
        created_by: Optional[UUID] = None,
        reference_type: Optional[str] = None,
        reference_id: Optional[UUID] = None
    ) -> Tuple[WalletLedger, Decimal]:
        """
        Credit points to a wallet.
        
        Args:
            db: Database session
            wallet: Target wallet
            points: Points to credit (positive number)
            source: Source of credit (hr_allocation, recognition, etc.)
            description: Optional description
            created_by: User ID who performed the action
            reference_type: Type of reference entity
            reference_id: ID of reference entity
            
        Returns:
            Tuple of (ledger_entry, new_balance)
        """
        points = Decimal(str(points))
        if points <= 0:
            raise ValueError("Credit amount must be positive")
        
        old_balance = Decimal(str(wallet.balance))
        wallet.balance = old_balance + points
        wallet.lifetime_earned = Decimal(str(wallet.lifetime_earned)) + points
        
        ledger_entry = WalletLedger(
            tenant_id=wallet.tenant_id,
            wallet_id=wallet.id,
            transaction_type='credit',
            source=source,
            points=points,
            balance_after=wallet.balance,
            description=description,
            created_by=created_by,
            reference_type=reference_type,
            reference_id=reference_id
        )
        db.add(ledger_entry)
        
        return ledger_entry, wallet.balance
    
    @staticmethod
    def debit_wallet(
        db: Session,
        wallet: Wallet,
        points: Decimal,
        source: str,
        description: Optional[str] = None,
        created_by: Optional[UUID] = None,
        reference_type: Optional[str] = None,
        reference_id: Optional[UUID] = None,
        allow_negative: bool = False
    ) -> Tuple[WalletLedger, Decimal]:
        """
        Debit points from a wallet.
        
        Args:
            db: Database session
            wallet: Target wallet
            points: Points to debit (positive number)
            source: Source of debit (redemption, etc.)
            description: Optional description
            created_by: User ID who performed the action
            reference_type: Type of reference entity
            reference_id: ID of reference entity
            allow_negative: Whether to allow negative balance
            
        Returns:
            Tuple of (ledger_entry, new_balance)
            
        Raises:
            ValueError: If insufficient balance and allow_negative is False
        """
        points = Decimal(str(points))
        if points <= 0:
            raise ValueError("Debit amount must be positive")
        
        old_balance = Decimal(str(wallet.balance))
        
        if not allow_negative and old_balance < points:
            raise ValueError(f"Insufficient balance. Available: {old_balance}, Required: {points}")
        
        wallet.balance = old_balance - points
        wallet.lifetime_spent = Decimal(str(wallet.lifetime_spent)) + points
        
        ledger_entry = WalletLedger(
            tenant_id=wallet.tenant_id,
            wallet_id=wallet.id,
            transaction_type='debit',
            source=source,
            points=points,
            balance_after=wallet.balance,
            description=description,
            created_by=created_by,
            reference_type=reference_type,
            reference_id=reference_id
        )
        db.add(ledger_entry)
        
        return ledger_entry, wallet.balance
    
    @staticmethod
    def log_wallet_action(
        db: Session,
        wallet: Wallet,
        actor_id: UUID,
        action: str,
        old_balance: Decimal,
        new_balance: Decimal,
        points: Decimal,
        extra_data: Optional[dict] = None
    ) -> AuditLog:
        """
        Create an audit log entry for a wallet action.
        
        Args:
            db: Database session
            wallet: Wallet that was modified
            actor_id: ID of user who performed the action
            action: Action type (points_allocated, redemption, etc.)
            old_balance: Balance before action
            new_balance: Balance after action
            points: Points involved in action
            extra_data: Additional data to include in audit log
            
        Returns:
            AuditLog entry
        """
        new_values = {
            "balance": str(new_balance),
            "points": str(points)
        }
        if extra_data:
            new_values.update(extra_data)
        
        audit = AuditLog(
            tenant_id=wallet.tenant_id,
            actor_id=actor_id,
            action=action,
            entity_type="wallet",
            entity_id=wallet.id,
            old_values={"balance": str(old_balance)},
            new_values=append_impersonation_metadata(new_values)
        )
        db.add(audit)
        return audit


# Convenience functions for direct use
def credit_user_wallet(
    db: Session,
    user: User,
    points: Decimal,
    source: str,
    description: Optional[str] = None,
    created_by: Optional[UUID] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[UUID] = None
) -> Tuple[Wallet, WalletLedger]:
    """
    Credit points to a user's wallet, creating the wallet if needed.
    
    Returns:
        Tuple of (wallet, ledger_entry)
    """
    wallet = WalletService.get_or_create_wallet(db, user)
    ledger_entry, _ = WalletService.credit_wallet(
        db, wallet, points, source, description,
        created_by, reference_type, reference_id
    )
    return wallet, ledger_entry


def debit_user_wallet(
    db: Session,
    user: User,
    points: Decimal,
    source: str,
    description: Optional[str] = None,
    created_by: Optional[UUID] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[UUID] = None
) -> Tuple[Wallet, WalletLedger]:
    """
    Debit points from a user's wallet.
    
    Returns:
        Tuple of (wallet, ledger_entry)
        
    Raises:
        ValueError: If wallet doesn't exist or insufficient balance
    """
    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    if not wallet:
        raise ValueError("User wallet not found")
    
    ledger_entry, _ = WalletService.debit_wallet(
        db, wallet, points, source, description,
        created_by, reference_type, reference_id
    )
    return wallet, ledger_entry
