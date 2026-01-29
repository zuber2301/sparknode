from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timedelta
import secrets
import string

from database import get_db
from core import append_impersonation_metadata
from models import (
    Brand, Voucher, TenantVoucher, Redemption, User,
    Wallet, WalletLedger, Feed, Notification, AuditLog
)
from auth.utils import get_current_user, get_hr_admin
from redemption.schemas import (
    BrandResponse, VoucherResponse, RedemptionCreate,
    RedemptionResponse, RedemptionDetailResponse
)

router = APIRouter()


def generate_voucher_code():
    """Generate a random voucher code"""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(16))


def generate_voucher_pin():
    """Generate a random voucher PIN"""
    return ''.join(secrets.choice(string.digits) for _ in range(4))


@router.get("/brands", response_model=List[BrandResponse])
async def get_brands(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available brands"""
    query = db.query(Brand).filter(Brand.is_active == True)
    
    if category:
        query = query.filter(Brand.category == category)
    
    brands = query.order_by(Brand.name).all()
    return brands


@router.get("/brands/categories")
async def get_brand_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all brand categories"""
    categories = db.query(Brand.category).filter(
        Brand.is_active == True,
        Brand.category != None
    ).distinct().all()
    return [c[0] for c in categories if c[0]]


@router.get("/vouchers", response_model=List[VoucherResponse])
async def get_vouchers(
    brand_id: Optional[UUID] = None,
    category: Optional[str] = None,
    max_points: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available vouchers for current tenant"""
    # Get vouchers available to tenant
    query = db.query(Voucher, Brand).join(
        Brand, Voucher.brand_id == Brand.id
    ).join(
        TenantVoucher, TenantVoucher.voucher_id == Voucher.id
    ).filter(
        TenantVoucher.tenant_id == current_user.tenant_id,
        TenantVoucher.is_active == True,
        Voucher.is_active == True,
        Brand.is_active == True
    )
    
    if brand_id:
        query = query.filter(Voucher.brand_id == brand_id)
    
    if category:
        query = query.filter(Brand.category == category)
    
    if max_points:
        query = query.filter(Voucher.points_required <= max_points)
    
    results = query.order_by(Brand.name, Voucher.points_required).all()
    
    vouchers = []
    for voucher, brand in results:
        vouchers.append(VoucherResponse(
            id=voucher.id,
            brand_id=voucher.brand_id,
            brand_name=brand.name,
            brand_logo=brand.logo_url,
            name=voucher.name,
            description=voucher.description,
            denomination=voucher.denomination,
            points_required=voucher.points_required,
            copay_amount=voucher.copay_amount or Decimal(0),
            image_url=voucher.image_url,
            terms_conditions=voucher.terms_conditions,
            validity_days=voucher.validity_days,
            is_active=voucher.is_active
        ))
    
    return vouchers


@router.get("/vouchers/{voucher_id}", response_model=VoucherResponse)
async def get_voucher(
    voucher_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific voucher"""
    result = db.query(Voucher, Brand).join(
        Brand, Voucher.brand_id == Brand.id
    ).filter(Voucher.id == voucher_id).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    voucher, brand = result
    
    return VoucherResponse(
        id=voucher.id,
        brand_id=voucher.brand_id,
        brand_name=brand.name,
        brand_logo=brand.logo_url,
        name=voucher.name,
        description=voucher.description,
        denomination=voucher.denomination,
        points_required=voucher.points_required,
        copay_amount=voucher.copay_amount or Decimal(0),
        image_url=voucher.image_url,
        terms_conditions=voucher.terms_conditions,
        validity_days=voucher.validity_days,
        is_active=voucher.is_active
    )


@router.post("/", response_model=RedemptionDetailResponse)
async def create_redemption(
    redemption_data: RedemptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Redeem points for a voucher"""
    # Get voucher
    voucher_result = db.query(Voucher, Brand).join(
        Brand, Voucher.brand_id == Brand.id
    ).filter(Voucher.id == redemption_data.voucher_id).first()
    
    if not voucher_result:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    voucher, brand = voucher_result
    
    if not voucher.is_active:
        raise HTTPException(status_code=400, detail="Voucher is not available")
    
    # Check if voucher is available for tenant
    tenant_voucher = db.query(TenantVoucher).filter(
        TenantVoucher.tenant_id == current_user.tenant_id,
        TenantVoucher.voucher_id == voucher.id,
        TenantVoucher.is_active == True
    ).first()
    
    if not tenant_voucher:
        raise HTTPException(status_code=400, detail="Voucher not available for your organization")
    
    # Get user's wallet
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet:
        raise HTTPException(status_code=400, detail="Wallet not found")
    
    points_required = tenant_voucher.custom_points_required or voucher.points_required
    
    # Check wallet balance
    if wallet.balance < points_required:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Required: {points_required}, Available: {wallet.balance}"
        )
    
    # Check stock (if applicable)
    if voucher.stock_quantity is not None and voucher.stock_quantity <= 0:
        raise HTTPException(status_code=400, detail="Voucher out of stock")
    
    # Create redemption
    redemption = Redemption(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        voucher_id=voucher.id,
        points_used=points_required,
        copay_amount=voucher.copay_amount or Decimal(0),
        status='processing'
    )
    db.add(redemption)
    db.flush()
    
    # Debit wallet
    old_balance = wallet.balance
    wallet.balance = Decimal(str(wallet.balance)) - points_required
    wallet.lifetime_spent = Decimal(str(wallet.lifetime_spent)) + points_required
    
    # Create ledger entry
    ledger_entry = WalletLedger(
        tenant_id=current_user.tenant_id,
        wallet_id=wallet.id,
        transaction_type='debit',
        source='redemption',
        points=points_required,
        balance_after=wallet.balance,
        reference_type='redemption',
        reference_id=redemption.id,
        description=f"Redeemed: {voucher.name}"
    )
    db.add(ledger_entry)
    
    # Simulate voucher fulfillment (in real app, call external provider API)
    redemption.voucher_code = generate_voucher_code()
    redemption.voucher_pin = generate_voucher_pin()
    redemption.status = 'completed'
    redemption.fulfilled_at = datetime.utcnow()
    redemption.expires_at = datetime.utcnow() + timedelta(days=voucher.validity_days)
    redemption.provider_reference = f"PERKSU-{secrets.token_hex(8).upper()}"
    
    # Update stock
    if voucher.stock_quantity is not None:
        voucher.stock_quantity -= 1
    
    # Create feed entry
    feed_entry = Feed(
        tenant_id=current_user.tenant_id,
        event_type='redemption',
        reference_type='redemption',
        reference_id=redemption.id,
        actor_id=current_user.id,
        visibility='private',
        metadata={
            "voucher_name": voucher.name,
            "brand_name": brand.name,
            "points_used": str(points_required)
        }
    )
    db.add(feed_entry)
    
    # Create notification
    notification = Notification(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        type='redemption_completed',
        title='Redemption Successful!',
        message=f"Your {voucher.name} voucher is ready. Check your redemption history for details.",
        reference_type='redemption',
        reference_id=redemption.id
    )
    db.add(notification)
    
    # Audit log
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="voucher_redeemed",
        entity_type="redemption",
        entity_id=redemption.id,
        new_values=append_impersonation_metadata({
            "voucher_id": str(voucher.id),
            "points_used": str(points_required),
            "old_balance": str(old_balance),
            "new_balance": str(wallet.balance)
        })
    )
    db.add(audit)
    
    db.commit()
    db.refresh(redemption)
    
    return RedemptionDetailResponse(
        id=redemption.id,
        tenant_id=redemption.tenant_id,
        user_id=redemption.user_id,
        voucher_id=redemption.voucher_id,
        points_used=redemption.points_used,
        copay_amount=redemption.copay_amount,
        voucher_code=redemption.voucher_code,
        voucher_pin=redemption.voucher_pin,
        status=redemption.status,
        provider_reference=redemption.provider_reference,
        fulfilled_at=redemption.fulfilled_at,
        expires_at=redemption.expires_at,
        created_at=redemption.created_at,
        voucher_name=voucher.name,
        brand_name=brand.name,
        denomination=voucher.denomination
    )


@router.get("/", response_model=List[RedemptionDetailResponse])
async def get_my_redemptions(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's redemption history"""
    query = db.query(Redemption, Voucher, Brand).join(
        Voucher, Redemption.voucher_id == Voucher.id
    ).join(
        Brand, Voucher.brand_id == Brand.id
    ).filter(
        Redemption.user_id == current_user.id
    )
    
    if status:
        query = query.filter(Redemption.status == status)
    
    results = query.order_by(Redemption.created_at.desc()).offset(skip).limit(limit).all()
    
    redemptions = []
    for redemption, voucher, brand in results:
        redemptions.append(RedemptionDetailResponse(
            id=redemption.id,
            tenant_id=redemption.tenant_id,
            user_id=redemption.user_id,
            voucher_id=redemption.voucher_id,
            points_used=redemption.points_used,
            copay_amount=redemption.copay_amount or Decimal(0),
            voucher_code=redemption.voucher_code,
            voucher_pin=redemption.voucher_pin,
            status=redemption.status,
            provider_reference=redemption.provider_reference,
            fulfilled_at=redemption.fulfilled_at,
            expires_at=redemption.expires_at,
            created_at=redemption.created_at,
            voucher_name=voucher.name,
            brand_name=brand.name,
            denomination=voucher.denomination
        ))
    
    return redemptions


@router.get("/{redemption_id}", response_model=RedemptionDetailResponse)
async def get_redemption(
    redemption_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific redemption"""
    result = db.query(Redemption, Voucher, Brand).join(
        Voucher, Redemption.voucher_id == Voucher.id
    ).join(
        Brand, Voucher.brand_id == Brand.id
    ).filter(
        Redemption.id == redemption_id,
        Redemption.user_id == current_user.id
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Redemption not found")
    
    redemption, voucher, brand = result
    
    return RedemptionDetailResponse(
        id=redemption.id,
        tenant_id=redemption.tenant_id,
        user_id=redemption.user_id,
        voucher_id=redemption.voucher_id,
        points_used=redemption.points_used,
        copay_amount=redemption.copay_amount or Decimal(0),
        voucher_code=redemption.voucher_code,
        voucher_pin=redemption.voucher_pin,
        status=redemption.status,
        provider_reference=redemption.provider_reference,
        fulfilled_at=redemption.fulfilled_at,
        expires_at=redemption.expires_at,
        created_at=redemption.created_at,
        voucher_name=voucher.name,
        brand_name=brand.name,
        denomination=voucher.denomination
    )
