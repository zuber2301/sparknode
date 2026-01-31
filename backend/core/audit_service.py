"""
Audit Service

Reusable service for audit logging operations.
This centralizes all audit log creation to ensure consistency across the application.
"""

from uuid import UUID
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from models import AuditLog, User, ActorType
from core import append_impersonation_metadata


class AuditService:
    """Service class for audit log operations"""
    
    @staticmethod
    def log_action(
        db: Session,
        tenant_id: UUID,
        actor_id: UUID,
        action: str,
        entity_type: str,
        entity_id: Optional[UUID] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        actor_type: ActorType = ActorType.USER,
        auto_append_impersonation: bool = True
    ) -> AuditLog:
        """
        Create an audit log entry.
        
        Args:
            db: Database session
            tenant_id: Tenant ID
            actor_id: ID of the user/admin performing the action
            action: Action type (e.g., 'user_created', 'points_allocated')
            entity_type: Type of entity (e.g., 'user', 'wallet', 'recognition')
            entity_id: ID of the affected entity
            old_values: Previous values (for updates)
            new_values: New values (for creates/updates)
            ip_address: IP address of the request
            actor_type: Type of actor (user or system_admin)
            auto_append_impersonation: Whether to append impersonation metadata
            
        Returns:
            Created AuditLog entry
        """
        # Apply impersonation metadata if requested
        if auto_append_impersonation and new_values:
            new_values = append_impersonation_metadata(new_values)
        
        audit = AuditLog(
            tenant_id=tenant_id,
            actor_id=actor_id,
            actor_type=actor_type,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values or {},
            new_values=new_values or {},
            ip_address=ip_address
        )
        db.add(audit)
        return audit
    
    @staticmethod
    def log_user_action(
        db: Session,
        current_user: User,
        action: str,
        entity_type: str,
        entity_id: Optional[UUID] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        """
        Create an audit log entry for a user action.
        
        This is a convenience method that extracts tenant_id from current_user.
        
        Args:
            db: Database session
            current_user: User performing the action
            action: Action type
            entity_type: Type of entity
            entity_id: ID of the affected entity
            old_values: Previous values
            new_values: New values
            ip_address: IP address of the request
            
        Returns:
            Created AuditLog entry
        """
        return AuditService.log_action(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            actor_type=ActorType.USER
        )
    
    @staticmethod
    def log_system_action(
        db: Session,
        tenant_id: UUID,
        admin_id: UUID,
        action: str,
        entity_type: str,
        entity_id: Optional[UUID] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        """
        Create an audit log entry for a system admin action.
        
        Args:
            db: Database session
            tenant_id: Tenant ID (can be None for platform-wide actions)
            admin_id: System admin ID
            action: Action type
            entity_type: Type of entity
            entity_id: ID of the affected entity
            old_values: Previous values
            new_values: New values
            ip_address: IP address of the request
            
        Returns:
            Created AuditLog entry
        """
        return AuditService.log_action(
            db=db,
            tenant_id=tenant_id,
            actor_id=admin_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            actor_type=ActorType.SYSTEM_ADMIN,
            auto_append_impersonation=False  # System admins don't use impersonation
        )


# Common audit action constants
class AuditActions:
    """Common audit action constants for consistency"""
    
    # User actions
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DEACTIVATED = "user_deactivated"
    USER_REACTIVATED = "user_reactivated"
    USER_DELETED = "user_deleted"
    USER_BULK_UPLOAD = "user_bulk_upload"
    
    # Wallet actions
    POINTS_ALLOCATED = "points_allocated"
    POINTS_ADJUSTED = "points_adjusted"
    POINTS_TRANSFERRED = "points_transferred"
    
    # Recognition actions
    RECOGNITION_SENT = "recognition_sent"
    RECOGNITION_REVOKED = "recognition_revoked"
    
    # Redemption actions
    REDEMPTION_CREATED = "redemption_created"
    REDEMPTION_PROCESSED = "redemption_processed"
    REDEMPTION_CANCELLED = "redemption_cancelled"
    
    # Budget actions
    BUDGET_CREATED = "budget_created"
    BUDGET_UPDATED = "budget_updated"
    BUDGET_ALLOCATED = "budget_allocated"
    LEAD_BUDGET_ALLOCATED = "lead_budget_allocated"
    
    # Tenant actions
    TENANT_CREATED = "tenant_created"
    TENANT_UPDATED = "tenant_updated"
    TENANT_SUSPENDED = "tenant_suspended"
    TENANT_ACTIVATED = "tenant_activated"
    
    # Event actions
    EVENT_CREATED = "event_created"
    EVENT_UPDATED = "event_updated"
    EVENT_PUBLISHED = "event_published"
    EVENT_CANCELLED = "event_cancelled"
    NOMINATION_CREATED = "nomination_created"
    NOMINATION_APPROVED = "nomination_approved"
    NOMINATION_REJECTED = "nomination_rejected"


# Convenience function for simple audit logging
def log_audit(
    db: Session,
    current_user: User,
    action: str,
    entity_type: str,
    entity_id: Optional[UUID] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None
) -> AuditLog:
    """
    Simple convenience function for audit logging.
    
    Args:
        db: Database session
        current_user: User performing the action
        action: Action type
        entity_type: Type of entity
        entity_id: ID of the affected entity
        old_values: Previous values
        new_values: New values
        
    Returns:
        Created AuditLog entry
    """
    return AuditService.log_user_action(
        db=db,
        current_user=current_user,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values
    )
