from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from decimal import Decimal

from database import get_db
from core import append_impersonation_metadata
from models import Wallet, WalletLedger, User, AuditLog
from auth.utils import get_current_user, get_hr_admin
from wallets.schemas import (
    WalletResponse, WalletLedgerResponse,
    PointsAllocationRequest, BulkPointsAllocationRequest, PointsAdjustmentRequest
)

router = APIRouter()


@router.get("/me", response_model=WalletResponse)
async def get_my_wallet(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's wallet"""
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet:
        # Create wallet if it doesn't exist
        wallet = Wallet(
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            balance=0,
            lifetime_earned=0,
            lifetime_spent=0
        )
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


@router.get("/me/ledger", response_model=List[WalletLedgerResponse])
async def get_my_wallet_ledger(
    skip: int = 0,
    limit: int = 50,
    source: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's wallet transaction history"""
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet:
        return []
    
    query = db.query(WalletLedger).filter(WalletLedger.wallet_id == wallet.id)
    
    if source:
        query = query.filter(WalletLedger.source == source)
    
    ledger = query.order_by(WalletLedger.created_at.desc()).offset(skip).limit(limit).all()
    return ledger


@router.get("/{user_id}", response_model=WalletResponse)
async def get_user_wallet(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific user's wallet (manager can view their reports, HR can view all)"""
    # Check permissions
    target_user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if current user can view this wallet
    if current_user.org_role not in ['tenant_manager', 'platform_admin', 'hr_admin']:
        if current_user.org_role in ['tenant_lead', 'manager']:
            # Manager can view their direct reports
            if target_user.manager_id != current_user.id and target_user.id != current_user.id:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            # Regular employees can only view their own wallet
            if target_user.id != current_user.id:
                raise HTTPException(status_code=403, detail="Access denied")
    
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return wallet


@router.get("/{user_id}/ledger", response_model=List[WalletLedgerResponse])
async def get_user_wallet_ledger(
    user_id: UUID,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Get a specific user's wallet ledger (HR Admin only)"""
    wallet = db.query(Wallet).filter(
        Wallet.user_id == user_id,
        Wallet.tenant_id == current_user.tenant_id
    ).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    ledger = db.query(WalletLedger).filter(
        WalletLedger.wallet_id == wallet.id
    ).order_by(WalletLedger.created_at.desc()).offset(skip).limit(limit).all()
    return ledger


@router.post("/allocate")
async def allocate_points(
    allocation: PointsAllocationRequest,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Allocate points to a user (HR Admin only)"""
    # Get target user
    target_user = db.query(User).filter(
        User.id == allocation.user_id,
        User.tenant_id == current_user.tenant_id
    ).first()

    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    # Restriction: Tenant Managers (HR Admins) can only allocate points to Tenant Leads
    if current_user.org_role in ['tenant_manager', 'hr_admin'] and target_user.org_role != 'tenant_lead':
        raise HTTPException(
            status_code=403,
            detail="Tenant Managers can only allocate points to Tenant Leads"
        )

    # Get target user's wallet
    wallet = db.query(Wallet).filter(
        Wallet.user_id == allocation.user_id,
        Wallet.tenant_id == current_user.tenant_id
    ).first()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="User wallet not found")
    
    # Update wallet balance
    old_balance = wallet.balance
    wallet.balance = Decimal(str(wallet.balance)) + allocation.points
    wallet.lifetime_earned = Decimal(str(wallet.lifetime_earned)) + allocation.points
    
    # Create ledger entry
    ledger_entry = WalletLedger(
        tenant_id=current_user.tenant_id,
        wallet_id=wallet.id,
        transaction_type='credit',
        source='hr_allocation',
        points=allocation.points,
        balance_after=wallet.balance,
        description=allocation.description or "HR Points Allocation",
        created_by=current_user.id
    )
    db.add(ledger_entry)
    
    # Audit log
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="points_allocated",
        entity_type="wallet",
        entity_id=wallet.id,
        old_values={"balance": str(old_balance)},
        new_values=append_impersonation_metadata({"balance": str(wallet.balance), "points_added": str(allocation.points)})
    )
    db.add(audit)
    
    db.commit()
    
    return {
        "message": "Points allocated successfully",
        "user_id": str(allocation.user_id),
        "points_allocated": str(allocation.points),
        "new_balance": str(wallet.balance)
    }


@router.post("/allocate/bulk")
async def bulk_allocate_points(
    allocation_data: BulkPointsAllocationRequest,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Allocate points to multiple users (HR Admin only)"""
    results = []
    
    for allocation in allocation_data.allocations:
        wallet = db.query(Wallet).filter(
            Wallet.user_id == allocation.user_id,
            Wallet.tenant_id == current_user.tenant_id
        ).first()
        
        if not wallet:
            results.append({
                "user_id": str(allocation.user_id),
                "status": "failed",
                "error": "Wallet not found"
            })
            continue
        
        # Update wallet
        wallet.balance = Decimal(str(wallet.balance)) + allocation.points
        wallet.lifetime_earned = Decimal(str(wallet.lifetime_earned)) + allocation.points
        
        # Create ledger entry
        ledger_entry = WalletLedger(
            tenant_id=current_user.tenant_id,
            wallet_id=wallet.id,
            transaction_type='credit',
            source='hr_allocation',
            points=allocation.points,
            balance_after=wallet.balance,
            description=allocation.description or "HR Bulk Points Allocation",
            created_by=current_user.id
        )
        db.add(ledger_entry)
        
        results.append({
            "user_id": str(allocation.user_id),
            "status": "success",
            "points_allocated": str(allocation.points),
            "new_balance": str(wallet.balance)
        })
    
    db.commit()
    
    return {"results": results}


@router.post("/{user_id}/adjust")
async def adjust_wallet_balance(
    user_id: UUID,
    adjustment: PointsAdjustmentRequest,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Adjust wallet balance (HR Admin only) - for corrections"""
    wallet = db.query(Wallet).filter(
        Wallet.user_id == user_id,
        Wallet.tenant_id == current_user.tenant_id
    ).first()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    old_balance = wallet.balance
    
    if adjustment.adjustment_type == 'credit':
        wallet.balance = Decimal(str(wallet.balance)) + adjustment.points
        wallet.lifetime_earned = Decimal(str(wallet.lifetime_earned)) + adjustment.points
    elif adjustment.adjustment_type == 'debit':
        if wallet.balance < adjustment.points:
            raise HTTPException(status_code=400, detail="Insufficient balance for debit adjustment")
        wallet.balance = Decimal(str(wallet.balance)) - adjustment.points
        wallet.lifetime_spent = Decimal(str(wallet.lifetime_spent)) + adjustment.points
    else:
        raise HTTPException(status_code=400, detail="Invalid adjustment type")
    
    # Create ledger entry
    ledger_entry = WalletLedger(
        tenant_id=current_user.tenant_id,
        wallet_id=wallet.id,
        transaction_type=adjustment.adjustment_type,
        source='adjustment',
        points=adjustment.points,
        balance_after=wallet.balance,
        description=f"Adjustment: {adjustment.reason}",
        created_by=current_user.id
    )
    db.add(ledger_entry)
    
    # Audit log
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="wallet_adjusted",
        entity_type="wallet",
        entity_id=wallet.id,
        old_values={"balance": str(old_balance)},
        new_values=append_impersonation_metadata({"balance": str(wallet.balance), "adjustment": str(adjustment.points), "type": adjustment.adjustment_type, "reason": adjustment.reason})
    )
    db.add(audit)
    
    db.commit()
    
    return {
        "message": "Wallet adjusted successfully",
        "old_balance": str(old_balance),
        "new_balance": str(wallet.balance)
    }
