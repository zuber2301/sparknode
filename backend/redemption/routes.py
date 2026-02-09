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
from auth.utils import get_current_user
from redemption.schemas import (
    BrandResponse, VoucherResponse, RedemptionCreate,
    RedemptionResponse, RedemptionDetailResponse,
    RedemptionVerifyOTPRequest, RedemptionDeliveryDetailsRequest
)
from redemption.aggregator import get_aggregator_client

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


@router.post("/initiate", response_model=RedemptionResponse)
async def initiate_redemption(
    redemption_data: RedemptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initiate a redemption and send OTP"""
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
    
    # Generate OTP
    otp = str(secrets.randbelow(1000000)).zfill(6)
    
    # Create redemption in pending_otp status
    redemption = Redemption(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        voucher_id=voucher.id,
        points_used=points_required,
        copay_amount=voucher.copay_amount or Decimal(0),
        status='pending_otp',
        reward_type=voucher.reward_type or 'voucher',
        otp_code=otp,
        otp_expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(redemption)
    db.flush()
    
    # Debit wallet (Lock points)
    old_balance = wallet.balance
    wallet.balance = Decimal(str(wallet.balance)) - points_required
    wallet.lifetime_spent = Decimal(str(wallet.lifetime_spent)) + points_required
    
    # Create ledger entry
    ledger_entry = WalletLedger(
        tenant_id=current_user.tenant_id,
        wallet_id=wallet.id,
        transaction_type='debit',
        source='redemption_initiated',
        points=points_required,
        balance_after=wallet.balance,
        reference_type='redemption',
        reference_id=redemption.id,
        description=f"Redemption initiated: {voucher.name} (OTP pending)"
    )
    db.add(ledger_entry)
    
    # Create notification with OTP
    notification = Notification(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        type='redemption_otp',
        title='Redemption Verification Code',
        message=f"Your verification code for {voucher.name} is: {otp}. It expires in 10 minutes.",
        reference_type='redemption',
        reference_id=redemption.id
    )
    db.add(notification)
    
    db.commit()
    db.refresh(redemption)
    
    return redemption


@router.post("/verify-otp", response_model=RedemptionResponse)
async def verify_redemption_otp(
    data: RedemptionVerifyOTPRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify OTP and proceed with redemption"""
    redemption = db.query(Redemption).filter(
        Redemption.id == data.redemption_id,
        Redemption.user_id == current_user.id,
        Redemption.status == 'pending_otp'
    ).first()
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption session not found or already verified")
        
    if redemption.otp_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired. Please resend.")
        
    if redemption.otp_code != data.otp:
        raise HTTPException(status_code=400, detail="Invalid verification code")
        
    # Mark as processing
    redemption.status = 'processing'
    redemption.otp_code = None # Clear OTP after use
    db.commit()
    
    # If it's a voucher, we can usually issue it immediately if using Mock or some providers
    # If it's merchandise, we might wait for delivery details.
    
    if redemption.reward_type == 'voucher':
        # Issue voucher logic
        try:
            voucher = db.query(Voucher).get(redemption.voucher_id)
            client = get_aggregator_client()
            issue_res = client.issue_voucher(
                tenant_id=redemption.tenant_id,
                vendor_code=voucher.vendor_code or f"MOCK-{voucher.denomination}",
                amount=float(voucher.denomination),
                metadata={
                    "redemption_id": str(redemption.id),
                    "email": current_user.corporate_email,
                    "first_name": current_user.first_name,
                    "last_name": current_user.last_name
                }
            )
            
            if issue_res.get("status") == "success":
                redemption.status = 'completed'
                redemption.voucher_code = issue_res.get("voucher_code")
                redemption.voucher_pin = issue_res.get("pin")
                redemption.provider_reference = issue_res.get("vendor_reference")
                redemption.fulfilled_at = datetime.utcnow()
                redemption.expires_at = datetime.utcnow() + timedelta(days=voucher.validity_days)
                
                # Update voucher stock
                if voucher.stock_quantity is not None:
                    voucher.stock_quantity -= 1
                    
                # Create final notification
                notification = Notification(
                    tenant_id=current_user.tenant_id,
                    user_id=current_user.id,
                    type='redemption_completed',
                    title='Reward Issued!',
                    message=f"Your {voucher.name} reward has been issued successfully.",
                    reference_type='redemption',
                    reference_id=redemption.id
                )
                db.add(notification)
            else:
                redemption.status = 'failed'
        except Exception as e:
            # In a real app, you'd log this and mark for retry
            redemption.status = 'failed'
            
    db.commit()
    db.refresh(redemption)
    return redemption


@router.post("/delivery-details", response_model=RedemptionResponse)
async def set_delivery_details(
    data: RedemptionDeliveryDetailsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set delivery details for physical rewards"""
    redemption = db.query(Redemption).filter(
        Redemption.id == data.redemption_id,
        Redemption.user_id == current_user.id
    ).first()
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption not found")
        
    if redemption.reward_type != 'merchandise':
        raise HTTPException(status_code=400, detail="Delivery details only required for merchandise")
        
    redemption.delivery_details = data.model_dump()
    redemption.status = 'processing' # Confirm it's in processing after delivery details
    
    db.commit()
    db.refresh(redemption)
    return redemption


@router.post("/resend-otp", response_model=dict)
async def resend_redemption_otp(
    redemption_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resend verification code"""
    redemption = db.query(Redemption).filter(
        Redemption.id == redemption_id,
        Redemption.user_id == current_user.id,
        Redemption.status == 'pending_otp'
    ).first()
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption session not found")
        
    # Generate new OTP
    otp = str(secrets.randbelow(1000000)).zfill(6)
    redemption.otp_code = otp
    redemption.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # Notify
    notification = Notification(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        type='redemption_otp',
        title='New Verification Code',
        message=f"Your new verification code is: {otp}. It expires in 10 minutes.",
        reference_type='redemption',
        reference_id=redemption.id
    )
    db.add(notification)
    
    db.commit()
    return {"status": "success", "message": "Verification code resent"}


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
    redemption.provider_reference = f"SPARKNODE-{secrets.token_hex(8).upper()}"
    
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
