"""
Tenant Self-Service Onboarding

Provides the API for new organizations to sign up as tenants on the platform.
This is the entry point for the self-service SaaS signup flow:

1. POST /api/tenants/register — Create a new tenant + first admin user
2. The first user becomes the tenant_manager automatically
3. A 14-day trial starts on the 'starter' tier
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from database import get_db
from models import Tenant, User, Department, Wallet, SystemAdmin
from auth.utils import get_password_hash, create_access_token
from auth.routes import get_user_roles
import re
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ─────────────────────────────────────────────────────────────────

class TenantRegistrationRequest(BaseModel):
    """Self-service tenant registration."""
    # Organization details
    company_name: str
    company_domain: Optional[str] = None  # e.g., "triton.com"

    # First admin user
    admin_email: EmailStr
    admin_password: str
    admin_first_name: str
    admin_last_name: str

    # Optional
    currency: str = "INR"
    subscription_tier: str = "starter"

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Company name must be at least 2 characters")
        return v.strip()

    @field_validator("admin_password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class TenantRegistrationResponse(BaseModel):
    tenant_id: str
    tenant_slug: str
    access_token: str
    token_type: str = "bearer"
    message: str


# ── Helpers ─────────────────────────────────────────────────────────────────

def _slugify(name: str) -> str:
    """Convert company name to URL-safe slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "-", slug)
    return slug[:64]


def _ensure_unique_slug(db: Session, base_slug: str) -> str:
    """Append a suffix if the slug already exists."""
    slug = base_slug
    counter = 1
    while db.query(Tenant).filter(Tenant.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug


# ── Route ───────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TenantRegistrationResponse)
async def register_tenant(
    data: TenantRegistrationRequest,
    db: Session = Depends(get_db),
):
    """
    Self-service tenant registration.

    Creates:
    1. A new Tenant with a 14-day trial on the requested tier
    2. A default "General" department
    3. The first admin user as tenant_manager
    4. A wallet for the admin user
    5. Returns a JWT so the admin can start using the platform immediately
    """
    # Validate email isn't already taken (across all tenants for the domain)
    existing = db.query(User).filter(User.corporate_email == data.admin_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please login instead.",
        )

    # Validate company name uniqueness (via slug)
    base_slug = _slugify(data.company_name)
    if not base_slug:
        raise HTTPException(status_code=400, detail="Invalid company name")
    slug = _ensure_unique_slug(db, base_slug)

    try:
        # 1. Create Tenant
        tenant = Tenant(
            id=uuid4(),
            name=data.company_name,
            slug=slug,
            domain=data.company_domain,
            currency=data.currency,
            display_currency=data.currency,
            base_currency="USD",
            subscription_tier=data.subscription_tier,
            subscription_status="active",
            subscription_started_at=datetime.utcnow(),
            subscription_ends_at=datetime.utcnow() + timedelta(days=14),  # 14-day trial
            max_users=50,  # starter default
            status="active",
            domain_whitelist=[f"@{data.company_domain}"] if data.company_domain else [],
            settings={
                "copay_enabled": False,
                "points_to_currency_ratio": 0.10,
                "recognition_approval_required": False,
                "peer_to_peer_recognition": True,
                "social_feed_enabled": True,
                "leaderboards_enabled": True,
            },
            feature_flags={},
        )
        db.add(tenant)
        db.flush()  # get tenant.id

        # 2. Create default department
        default_dept = Department(
            id=uuid4(),
            tenant_id=tenant.id,
            name="General",
        )
        db.add(default_dept)
        db.flush()

        # 3. Create admin user
        roles_config = get_user_roles("tenant_manager")
        admin_user = User(
            id=uuid4(),
            tenant_id=tenant.id,
            corporate_email=data.admin_email,
            password_hash=get_password_hash(data.admin_password),
            first_name=data.admin_first_name,
            last_name=data.admin_last_name,
            org_role="tenant_manager",
            roles=roles_config["roles"],
            default_role=roles_config["default_role"],
            department_id=default_dept.id,
            status="ACTIVE",
        )
        db.add(admin_user)
        db.flush()

        # 4. Create wallet for admin
        wallet = Wallet(
            id=uuid4(),
            tenant_id=tenant.id,
            user_id=admin_user.id,
            balance=0,
            lifetime_earned=0,
            lifetime_spent=0,
        )
        db.add(wallet)

        db.commit()

        # 5. Generate JWT
        access_token = create_access_token(
            data={
                "sub": str(admin_user.id),
                "tenant_id": str(tenant.id),
                "email": admin_user.corporate_email,
                "org_role": "tenant_manager",
                "roles": roles_config["roles"],
                "default_role": roles_config["default_role"],
                "type": "tenant",
            },
            expires_delta=timedelta(minutes=60),
        )

        logger.info(f"New tenant registered: {tenant.name} (slug={slug})")

        return TenantRegistrationResponse(
            tenant_id=str(tenant.id),
            tenant_slug=slug,
            access_token=access_token,
            message=f"Welcome to SparkNode! Your 14-day trial has started.",
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Tenant registration failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again.",
        )
