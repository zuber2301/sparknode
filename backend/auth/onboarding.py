"""
Tenant-User Onboarding Module

Implements two mechanisms for associating new users with tenants:
1. Domain-Match Auto-Onboarding: Email domain whitelist matching
2. Invite-Link Method: Secure token-based tenant assignment
"""

from typing import Optional, Tuple
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status
import secrets

from models import Tenant, InvitationToken


def extract_email_domain(email: str) -> str:
    """Extract domain from email address."""
    if "@" not in email:
        raise ValueError("Invalid email format")
    return email.split("@")[1]


def resolve_tenant_by_domain(db: Session, email: str) -> Optional[UUID]:
    """
    Domain-Match Auto-Onboarding Strategy
    
    Resolves tenant by matching the email domain against tenant domain whitelists.
    
    Args:
        db: Database session
        email: User's email address
        
    Returns:
        Tenant ID if domain matches a whitelisted tenant, None otherwise
        
    Example:
        User email: john@triton.com
        Tenant: Triton Energy
        domain_whitelist: ["@triton.com", "@tritontech.com"]
        Result: Tenant ID for Triton Energy
    """
    try:
        domain = extract_email_domain(email)
    except ValueError:
        return None
    
    # Query tenants with matching domain whitelist
    # domain_whitelist is a JSONB array of domain suffixes like ["@triton.com", "@tritontech.com"]
    tenants = db.query(Tenant).filter(
        Tenant.status == 'active',
        Tenant.subscription_status == 'active'
    ).all()
    
    for tenant in tenants:
        if not tenant.domain_whitelist:
            continue
        
        # Check if domain or @domain matches any entry in whitelist
        for whitelisted_domain in tenant.domain_whitelist:
            # Support both "domain.com" and "@domain.com" formats
            whitelisted = whitelisted_domain.lstrip("@")
            current_domain = domain.lstrip("@")
            
            if whitelisted.lower() == current_domain.lower():
                return tenant.id
    
    return None


def generate_invitation_token(db: Session, tenant_id: UUID, email: str, expires_hours: int = 24) -> str:
    """
    Generate a secure invitation token for invite-link onboarding.
    
    Args:
        db: Database session
        tenant_id: Target tenant ID
        email: Email address being invited
        expires_hours: Token expiration time in hours
        
    Returns:
        Secure token string
        
    Raises:
        HTTPException if tenant not found or not active
    """
    # Verify tenant exists and is active
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id,
        Tenant.status == 'active'
    ).first()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found or not active"
        )
    
    # Generate secure random token
    token_string = secrets.token_urlsafe(32)
    
    # Create invitation record
    invitation = InvitationToken(
        tenant_id=tenant_id,
        email=email,
        token=token_string,
        expires_at=datetime.utcnow() + timedelta(hours=expires_hours)
    )
    
    db.add(invitation)
    db.commit()
    
    return token_string


def resolve_tenant_by_invitation_token(db: Session, token: str, email: str) -> Optional[UUID]:
    """
    Invite-Link Onboarding Strategy
    
    Resolves tenant using a secure invitation token. Validates that:
    - Token exists
    - Token matches the provided email
    - Token has not expired
    
    Args:
        db: Database session
        token: Invitation token from join link
        email: Email address claiming the token
        
    Returns:
        Tenant ID if token is valid, None otherwise
        
    Example:
        Join Link: app.sparknode.io/signup?token=ABC123XYZ&email=john@example.com
        Result: Tenant ID for the inviting organization
    """
    # Query the invitation token
    invitation = db.query(InvitationToken).filter(
        InvitationToken.token == token,
        InvitationToken.email == email.lower()
    ).first()
    
    if not invitation:
        return None
    
    # Check if token has expired (handle both naive and aware datetimes)
    from datetime import datetime as dt
    expires = invitation.expires_at
    now = datetime.utcnow()
    
    # Convert to timezone-naive if needed for comparison
    if expires.tzinfo is not None:
        expires = expires.replace(tzinfo=None)
    if now.tzinfo is not None:
        now = now.replace(tzinfo=None)
    
    if expires < now:
        # Mark as expired
        invitation.is_used = True
        db.commit()
        return None
    
    # Return the tenant ID
    return invitation.tenant_id


def resolve_tenant(
    db: Session,
    email: str,
    invitation_token: Optional[str] = None
) -> Tuple[Optional[UUID], str]:
    """
    Master Tenant Resolution Function
    
    Attempts to resolve tenant through multiple mechanisms in priority order:
    1. Invitation Token (if provided) - explicit tenant assignment
    2. Domain-Match (implicit) - email domain whitelist matching
    
    Args:
        db: Database session
        email: User's email address
        invitation_token: Optional invitation token from join link
        
    Returns:
        Tuple of (tenant_id, resolution_method)
        - tenant_id: UUID if resolved, None if no tenant found
        - resolution_method: "token", "domain", or "none"
        
    Raises:
        ValueError: If email is invalid
        
    Example:
        # Invitation token provided
        tenant_id, method = resolve_tenant(db, "john@example.com", token="ABC123")
        
        # Auto-enrollment via domain
        tenant_id, method = resolve_tenant(db, "john@triton.com")
    """
    if not email or "@" not in email:
        raise ValueError("Invalid email address")
    
    # Strategy 1: Invitation Token (highest priority)
    if invitation_token:
        tenant_id = resolve_tenant_by_invitation_token(db, invitation_token, email)
        if tenant_id:
            # Mark token as used
            invitation = db.query(InvitationToken).filter(
                InvitationToken.token == invitation_token,
                InvitationToken.email == email.lower()
            ).first()
            if invitation:
                invitation.is_used = True
                db.commit()
            return tenant_id, "token"
    
    # Strategy 2: Domain Whitelist (implicit auto-enrollment)
    tenant_id = resolve_tenant_by_domain(db, email)
    if tenant_id:
        return tenant_id, "domain"
    
    # No resolution found
    return None, "none"


def validate_tenant_for_onboarding(db: Session, tenant_id: UUID) -> bool:
    """
    Validate that a tenant is eligible for user onboarding.
    
    Checks:
    - Tenant exists
    - Tenant is active
    - Subscription is active
    - User limit not exceeded
    
    Args:
        db: Database session
        tenant_id: Tenant to validate
        
    Returns:
        True if tenant is valid for onboarding
        
    Raises:
        HTTPException with appropriate error details
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    if tenant.status != 'active':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization is not active"
        )
    
    if tenant.subscription_status != 'active':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization subscription is not active"
        )
    
    # Check user limit
    from models import User  # Import here to avoid circular imports
    user_count = db.query(User).filter(User.tenant_id == tenant_id).count()
    
    if user_count >= tenant.max_users:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Organization has reached maximum user limit ({tenant.max_users})"
        )
    
    return True
