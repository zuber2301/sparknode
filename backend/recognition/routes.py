from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID
from decimal import Decimal

from database import get_db
from core import append_impersonation_metadata
from core.budget_service import BudgetService, BudgetAllocationError
from models import (
    Recognition, Badge, User, Wallet, WalletLedger, Tenant,
    DepartmentBudget, Feed, Notification, AuditLog,
    RecognitionComment, RecognitionReaction
)
from auth.utils import get_current_user, get_manager_or_above
from recognition.schemas import (
    BadgeResponse, RecognitionCreate, RecognitionResponse,
    RecognitionDetailResponse, RecognitionCommentCreate, RecognitionCommentResponse,
    RecognitionStats
)

router = APIRouter()


@router.get("/badges", response_model=List[BadgeResponse])
async def get_badges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available badges"""
    badges = db.query(Badge).filter(
        (Badge.tenant_id == current_user.tenant_id) | (Badge.is_system == True)
    ).all()
    return badges


@router.get("/", response_model=List[RecognitionDetailResponse])
async def get_recognitions(
    skip: int = 0,
    limit: int = 20,
    user_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get recognitions feed"""
    query = db.query(Recognition).filter(
        Recognition.tenant_id == current_user.tenant_id,
        Recognition.status == 'active',
        Recognition.visibility == 'public'
    )
    
    if user_id:
        query = query.filter(
            (Recognition.from_user_id == user_id) | (Recognition.to_user_id == user_id)
        )
    
    recognitions = query.order_by(Recognition.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for rec in recognitions:
        from_user = db.query(User).filter(User.id == rec.from_user_id).first()
        to_user = db.query(User).filter(User.id == rec.to_user_id).first()
        badge = db.query(Badge).filter(Badge.id == rec.badge_id).first() if rec.badge_id else None
        
        comments_count = db.query(RecognitionComment).filter(
            RecognitionComment.recognition_id == rec.id
        ).count()
        
        reactions_count = db.query(RecognitionReaction).filter(
            RecognitionReaction.recognition_id == rec.id
        ).count()
        
        user_reacted = db.query(RecognitionReaction).filter(
            RecognitionReaction.recognition_id == rec.id,
            RecognitionReaction.user_id == current_user.id
        ).first() is not None
        
        result.append(RecognitionDetailResponse(
            id=rec.id,
            tenant_id=rec.tenant_id,
            from_user_id=rec.from_user_id,
            to_user_id=rec.to_user_id,
            badge_id=rec.badge_id,
            points=rec.points,
            message=rec.message,
            visibility=rec.visibility,
            status=rec.status,
            created_at=rec.created_at,
            from_user_name=f"{from_user.first_name} {from_user.last_name}" if from_user else "Unknown",
            to_user_name=f"{to_user.first_name} {to_user.last_name}" if to_user else "Unknown",
            badge_name=badge.name if badge else None,
            comments_count=comments_count,
            reactions_count=reactions_count,
            user_reacted=user_reacted
        ))
    
    return result


@router.post("/", response_model=RecognitionResponse)
async def create_recognition(
    recognition_data: RecognitionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new recognition
    
    If points are included, they are deducted from the tenant's allocation pool
    and added to the recipient's wallet.
    """
    # Validate recipient exists
    recipient = db.query(User).filter(
        User.id == recognition_data.to_user_id,
        User.tenant_id == current_user.tenant_id
    ).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Can't recognize yourself
    if recognition_data.to_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot recognize yourself")
    
    # Get tenant
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Validate points allocation pool if points are being awarded
    if recognition_data.points > 0:
        # Check manager/lead has permission to award points
        if current_user.org_role not in ['manager', 'hr_admin', 'tenant_lead', 'tenant_manager']:
            raise HTTPException(
                status_code=403,
                detail="Only managers and leads can award recognition points"
            )
        
        # Check tenant has sufficient allocation balance
        if Decimal(str(tenant.points_allocation_balance)) < Decimal(str(recognition_data.points)):
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient points in distribution pool. Available: {tenant.points_allocation_balance}, Requested: {recognition_data.points}"
            )
    
    # Create recognition
    recognition = Recognition(
        tenant_id=current_user.tenant_id,
        from_user_id=current_user.id,
        to_user_id=recognition_data.to_user_id,
        badge_id=recognition_data.badge_id,
        points=recognition_data.points,
        message=recognition_data.message,
        visibility=recognition_data.visibility,
        status='active'
    )
    db.add(recognition)
    db.flush()
    
    # Process budget using BudgetService if applicable
    if recognition_data.points > 0:
        try:
            wallet, ledger, distribution_log = BudgetService.awardToUser(
                db=db,
                tenant=tenant,
                from_user=current_user,
                to_user=recipient,
                amount=Decimal(str(recognition_data.points)),
                reference_type='recognition',
                reference_id=recognition.id,
                description=recognition_data.message[:200]
            )
        except BudgetAllocationError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))
    
    # Create feed entry
    feed_entry = Feed(
        tenant_id=current_user.tenant_id,
        event_type='recognition',
        reference_type='recognition',
        reference_id=recognition.id,
        actor_id=current_user.id,
        target_id=recipient.id,
        visibility=recognition_data.visibility,
        event_metadata={
            "points": str(recognition_data.points),
            "message": recognition_data.message[:100]
        }
    )
    db.add(feed_entry)
    
    # Create notification for recipient
    notification = Notification(
        tenant_id=current_user.tenant_id,
        user_id=recipient.id,
        type='recognition_received',
        title='You received recognition!',
        message=f"{current_user.first_name} {current_user.last_name} recognized you with {recognition_data.points} points",
        reference_type='recognition',
        reference_id=recognition.id
    )
    db.add(notification)
    
    # Audit log
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="recognition_created",
        entity_type="recognition",
        entity_id=recognition.id,
        new_values=append_impersonation_metadata({
            "to_user_id": str(recognition_data.to_user_id),
            "points": str(recognition_data.points),
            "message": recognition_data.message
        })
    )
    db.add(audit)
    
    db.commit()
    db.refresh(recognition)
    
    return recognition


@router.get("/{recognition_id}", response_model=RecognitionDetailResponse)
async def get_recognition(
    recognition_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific recognition"""
    rec = db.query(Recognition).filter(
        Recognition.id == recognition_id,
        Recognition.tenant_id == current_user.tenant_id
    ).first()
    
    if not rec:
        raise HTTPException(status_code=404, detail="Recognition not found")
    
    from_user = db.query(User).filter(User.id == rec.from_user_id).first()
    to_user = db.query(User).filter(User.id == rec.to_user_id).first()
    badge = db.query(Badge).filter(Badge.id == rec.badge_id).first() if rec.badge_id else None
    
    comments_count = db.query(RecognitionComment).filter(
        RecognitionComment.recognition_id == rec.id
    ).count()
    
    reactions_count = db.query(RecognitionReaction).filter(
        RecognitionReaction.recognition_id == rec.id
    ).count()
    
    user_reacted = db.query(RecognitionReaction).filter(
        RecognitionReaction.recognition_id == rec.id,
        RecognitionReaction.user_id == current_user.id
    ).first() is not None
    
    return RecognitionDetailResponse(
        id=rec.id,
        tenant_id=rec.tenant_id,
        from_user_id=rec.from_user_id,
        to_user_id=rec.to_user_id,
        badge_id=rec.badge_id,
        points=rec.points,
        message=rec.message,
        visibility=rec.visibility,
        status=rec.status,
        created_at=rec.created_at,
        from_user_name=f"{from_user.first_name} {from_user.last_name}" if from_user else "Unknown",
        to_user_name=f"{to_user.first_name} {to_user.last_name}" if to_user else "Unknown",
        badge_name=badge.name if badge else None,
        comments_count=comments_count,
        reactions_count=reactions_count,
        user_reacted=user_reacted
    )


@router.post("/{recognition_id}/react")
async def toggle_reaction(
    recognition_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle reaction (like) on a recognition"""
    recognition = db.query(Recognition).filter(
        Recognition.id == recognition_id,
        Recognition.tenant_id == current_user.tenant_id
    ).first()
    
    if not recognition:
        raise HTTPException(status_code=404, detail="Recognition not found")
    
    existing_reaction = db.query(RecognitionReaction).filter(
        RecognitionReaction.recognition_id == recognition_id,
        RecognitionReaction.user_id == current_user.id
    ).first()
    
    if existing_reaction:
        db.delete(existing_reaction)
        db.commit()
        return {"action": "removed", "message": "Reaction removed"}
    else:
        reaction = RecognitionReaction(
            recognition_id=recognition_id,
            user_id=current_user.id,
            reaction_type='like'
        )
        db.add(reaction)
        db.commit()
        return {"action": "added", "message": "Reaction added"}


@router.get("/{recognition_id}/comments", response_model=List[RecognitionCommentResponse])
async def get_comments(
    recognition_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comments on a recognition"""
    comments = db.query(RecognitionComment).filter(
        RecognitionComment.recognition_id == recognition_id
    ).order_by(RecognitionComment.created_at.asc()).all()
    
    result = []
    for comment in comments:
        user = db.query(User).filter(User.id == comment.user_id).first()
        result.append(RecognitionCommentResponse(
            id=comment.id,
            recognition_id=comment.recognition_id,
            user_id=comment.user_id,
            user_name=f"{user.first_name} {user.last_name}" if user else "Unknown",
            content=comment.content,
            created_at=comment.created_at
        ))
    
    return result


@router.post("/{recognition_id}/comments", response_model=RecognitionCommentResponse)
async def add_comment(
    recognition_id: UUID,
    comment_data: RecognitionCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a comment to a recognition"""
    recognition = db.query(Recognition).filter(
        Recognition.id == recognition_id,
        Recognition.tenant_id == current_user.tenant_id
    ).first()
    
    if not recognition:
        raise HTTPException(status_code=404, detail="Recognition not found")
    
    comment = RecognitionComment(
        recognition_id=recognition_id,
        user_id=current_user.id,
        content=comment_data.content
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    return RecognitionCommentResponse(
        id=comment.id,
        recognition_id=comment.recognition_id,
        user_id=comment.user_id,
        user_name=f"{current_user.first_name} {current_user.last_name}",
        content=comment.content,
        created_at=comment.created_at
    )


@router.get("/stats/me", response_model=RecognitionStats)
async def get_my_recognition_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's recognition statistics"""
    # Given stats
    given_stats = db.query(
        func.count(Recognition.id),
        func.coalesce(func.sum(Recognition.points), 0)
    ).filter(
        Recognition.from_user_id == current_user.id,
        Recognition.status == 'active'
    ).first()
    
    # Received stats
    received_stats = db.query(
        func.count(Recognition.id),
        func.coalesce(func.sum(Recognition.points), 0)
    ).filter(
        Recognition.to_user_id == current_user.id,
        Recognition.status == 'active'
    ).first()
    
    # Top badges received
    top_badges = db.query(
        Badge.name,
        func.count(Recognition.id).label('count')
    ).join(Recognition, Recognition.badge_id == Badge.id).filter(
        Recognition.to_user_id == current_user.id,
        Recognition.status == 'active'
    ).group_by(Badge.name).order_by(func.count(Recognition.id).desc()).limit(5).all()
    
    return RecognitionStats(
        total_given=given_stats[0] or 0,
        total_received=received_stats[0] or 0,
        points_given=Decimal(str(given_stats[1] or 0)),
        points_received=Decimal(str(received_stats[1] or 0)),
        top_badges=[{"name": b[0], "count": b[1]} for b in top_badges]
    )
