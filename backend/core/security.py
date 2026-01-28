"""
Security utilities for multi-tenant operations.

This module provides:
- QR token generation and verification for mobile logistics
- Secure code generation for vouchers and verification
- Tenant-isolated token validation
"""

import secrets
import string
import hashlib
import hmac
import time
from datetime import datetime, timedelta
from typing import Optional, Tuple
from uuid import UUID
import base64
import json

from jose import jwt, JWTError
from cryptography.fernet import Fernet
from pydantic import BaseModel

from config import settings


class QRTokenPayload(BaseModel):
    """Payload structure for QR code tokens."""
    user_id: str
    tenant_id: str
    event_id: Optional[str] = None
    activity_id: Optional[str] = None
    token_type: str  # 'event_checkin', 'gift_pickup', 'verification'
    issued_at: int
    expires_at: int
    nonce: str


class QRVerificationResult(BaseModel):
    """Result of QR token verification."""
    valid: bool
    payload: Optional[QRTokenPayload] = None
    error: Optional[str] = None


def generate_qr_token(
    user_id: UUID,
    tenant_id: UUID,
    token_type: str,
    event_id: Optional[UUID] = None,
    activity_id: Optional[UUID] = None,
    expiry_minutes: int = 30
) -> str:
    """
    Generate a secure QR token that combines user_id and tenant_id.
    
    This ensures a voucher from "Tenant A" cannot be scanned by an admin from "Tenant B".
    
    Args:
        user_id: The user's unique identifier
        tenant_id: The tenant's unique identifier  
        token_type: Type of token ('event_checkin', 'gift_pickup', 'verification')
        event_id: Optional event identifier
        activity_id: Optional activity identifier
        expiry_minutes: Token validity in minutes (default 30)
    
    Returns:
        A base64-encoded encrypted token string suitable for QR codes
    """
    now = int(time.time())
    nonce = secrets.token_hex(16)
    
    payload = QRTokenPayload(
        user_id=str(user_id),
        tenant_id=str(tenant_id),
        event_id=str(event_id) if event_id else None,
        activity_id=str(activity_id) if activity_id else None,
        token_type=token_type,
        issued_at=now,
        expires_at=now + (expiry_minutes * 60),
        nonce=nonce
    )
    
    # Encode as JWT with tenant-specific claim
    token = jwt.encode(
        payload.model_dump(),
        settings.secret_key,
        algorithm=settings.algorithm
    )
    
    return token


def verify_qr_token(
    token: str,
    expected_tenant_id: UUID,
    expected_token_type: Optional[str] = None
) -> QRVerificationResult:
    """
    Verify a QR token and ensure it belongs to the expected tenant.
    
    Args:
        token: The QR token to verify
        expected_tenant_id: The tenant ID that should own this token
        expected_token_type: Optional expected token type for additional validation
    
    Returns:
        QRVerificationResult with validation status and decoded payload
    """
    try:
        # Decode the JWT
        payload_dict = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )
        
        payload = QRTokenPayload(**payload_dict)
        
        # Check expiration
        if payload.expires_at < int(time.time()):
            return QRVerificationResult(
                valid=False,
                error="Token has expired"
            )
        
        # Verify tenant isolation
        if str(expected_tenant_id) != payload.tenant_id:
            return QRVerificationResult(
                valid=False,
                error="Token belongs to a different tenant"
            )
        
        # Verify token type if specified
        if expected_token_type and payload.token_type != expected_token_type:
            return QRVerificationResult(
                valid=False,
                error=f"Invalid token type. Expected: {expected_token_type}"
            )
        
        return QRVerificationResult(
            valid=True,
            payload=payload
        )
        
    except JWTError as e:
        return QRVerificationResult(
            valid=False,
            error=f"Invalid token: {str(e)}"
        )
    except Exception as e:
        return QRVerificationResult(
            valid=False,
            error=f"Verification error: {str(e)}"
        )


def generate_secure_code(length: int = 16, include_lowercase: bool = False) -> str:
    """
    Generate a cryptographically secure random code.
    
    Used for voucher codes, verification codes, etc.
    
    Args:
        length: Length of the code (default 16)
        include_lowercase: Whether to include lowercase letters (default False)
    
    Returns:
        A secure random code string
    """
    chars = string.ascii_uppercase + string.digits
    if include_lowercase:
        chars += string.ascii_lowercase
    return ''.join(secrets.choice(chars) for _ in range(length))


def generate_voucher_code() -> str:
    """Generate a voucher redemption code in format XXXX-XXXX-XXXX-XXXX."""
    parts = [generate_secure_code(4) for _ in range(4)]
    return '-'.join(parts)


def generate_voucher_pin() -> str:
    """Generate a 4-digit voucher PIN."""
    return ''.join(secrets.choice(string.digits) for _ in range(4))


def generate_verification_code() -> str:
    """Generate a 6-digit verification code."""
    return ''.join(secrets.choice(string.digits) for _ in range(6))


def hash_token(token: str) -> str:
    """
    Create a hash of a token for secure storage.
    
    Used when tokens need to be stored in database for lookup
    without storing the actual token value.
    """
    return hashlib.sha256(
        (token + settings.secret_key).encode()
    ).hexdigest()


def verify_token_hash(token: str, stored_hash: str) -> bool:
    """Verify a token against its stored hash."""
    return hmac.compare_digest(hash_token(token), stored_hash)


class TenantEncryption:
    """
    Tenant-specific encryption utilities.
    
    Uses a derived key based on tenant_id to provide
    tenant-isolated encryption for sensitive data.
    """
    
    @staticmethod
    def get_tenant_key(tenant_id: UUID) -> bytes:
        """Derive a tenant-specific encryption key."""
        combined = f"{settings.secret_key}:{tenant_id}"
        key_bytes = hashlib.sha256(combined.encode()).digest()
        return base64.urlsafe_b64encode(key_bytes)
    
    @staticmethod
    def encrypt(data: str, tenant_id: UUID) -> str:
        """Encrypt data using tenant-specific key."""
        key = TenantEncryption.get_tenant_key(tenant_id)
        f = Fernet(key)
        return f.encrypt(data.encode()).decode()
    
    @staticmethod
    def decrypt(encrypted_data: str, tenant_id: UUID) -> str:
        """Decrypt data using tenant-specific key."""
        key = TenantEncryption.get_tenant_key(tenant_id)
        f = Fernet(key)
        return f.decrypt(encrypted_data.encode()).decode()


def create_event_qr_data(
    user_id: UUID,
    tenant_id: UUID,
    event_id: UUID,
    activity_id: Optional[UUID] = None
) -> str:
    """
    Create QR code data for event check-in.
    
    Returns JSON string suitable for QR code generation containing
    the verification token and display information.
    """
    token = generate_qr_token(
        user_id=user_id,
        tenant_id=tenant_id,
        token_type='event_checkin',
        event_id=event_id,
        activity_id=activity_id,
        expiry_minutes=60 * 24  # 24 hours for event tokens
    )
    
    qr_data = {
        "v": 1,  # Version
        "t": token,
        "type": "sparknode_event"
    }
    
    return json.dumps(qr_data)


def create_gift_pickup_qr_data(
    user_id: UUID,
    tenant_id: UUID,
    event_id: UUID,
    gift_allocation_id: UUID
) -> str:
    """
    Create QR code data for gift pickup verification.
    
    Returns JSON string suitable for QR code generation.
    """
    token = generate_qr_token(
        user_id=user_id,
        tenant_id=tenant_id,
        token_type='gift_pickup',
        event_id=event_id,
        activity_id=gift_allocation_id,
        expiry_minutes=60 * 72  # 72 hours for gift pickup
    )
    
    qr_data = {
        "v": 1,
        "t": token,
        "type": "sparknode_gift"
    }
    
    return json.dumps(qr_data)
