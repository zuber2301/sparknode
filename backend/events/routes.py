"""
Events & Logistics Routes

Tenant-specific event management with:
- Custom event wizards per tenant culture
- Modular sub-activities (Performance vs Gifting tracks)
- Approval workflows for localized governance
- QR-based check-in and gift verification
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timedelta
import json

from database import get_db
from core import append_impersonation_metadata
from models import (
    Event, EventActivity, EventParticipant, ActivityParticipant,
    EventBudget, EventGiftItem, GiftAllocation, User, Feed, Notification, AuditLog
)
from auth.utils import get_current_user
from core.rbac import (
    require_permission, Permission, RolePermissions,
    get_tenant_admin, get_tenant_lead
)
from core.security import (
    generate_qr_token, verify_qr_token, hash_token,
    create_event_qr_data, create_gift_pickup_qr_data
)
from events.schemas import (
    EventCreate, EventUpdate, EventResponse, EventDetailResponse,
    EventActivityCreate, EventActivityUpdate, EventActivityResponse,
    EventRegistrationRequest, EventParticipantResponse, ParticipantApprovalRequest,
    ActivityParticipantResponse,
    EventBudgetCreate, EventBudgetUpdate, EventBudgetResponse,
    GiftItemCreate, GiftItemUpdate, GiftItemResponse,
    GiftAllocationCreate, GiftAllocationResponse, GiftPickupVerification, GiftPickupResponse,
    QRCodeRequest, QRCodeResponse, CheckInRequest, CheckInResponse
)

router = APIRouter()


# =====================================================
# EVENT CRUD ENDPOINTS
# =====================================================

@router.get("/", response_model=List[EventResponse])
async def get_events(
    status: Optional[str] = None,
    event_type: Optional[str] = None,
    upcoming_only: bool = False,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all events for current tenant"""
    query = db.query(Event).filter(Event.tenant_id == current_user.tenant_id)
    
    if status:
        query = query.filter(Event.status == status)
    if event_type:
        query = query.filter(Event.event_type == event_type)
    if upcoming_only:
        query = query.filter(Event.start_date >= datetime.utcnow())
    
    events = query.order_by(Event.start_date.desc()).offset(skip).limit(limit).all()
    
    result = []
    for event in events:
        participant_count = db.query(EventParticipant).filter(
            EventParticipant.event_id == event.id,
            EventParticipant.status.in_(['approved', 'checked_in', 'completed'])
        ).count()
        
        result.append(EventResponse(
            **{k: v for k, v in event.__dict__.items() if not k.startswith('_')},
            participant_count=participant_count,
            is_registration_open=event.is_registration_open
        ))
    
    return result


@router.post("/", response_model=EventResponse)
async def create_event(
    event_data: EventCreate,
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db)
):
    """Create a new event (Tenant Admin only)"""
    event = Event(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        **event_data.model_dump()
    )
    db.add(event)
    
    # Audit log
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="event_created",
        entity_type="event",
        entity_id=event.id,
        new_values=append_impersonation_metadata({"name": event.name, "event_type": event.event_type})
    )
    db.add(audit)
    
    db.commit()
    db.refresh(event)
    
    return EventResponse(
        **{k: v for k, v in event.__dict__.items() if not k.startswith('_')},
        participant_count=0,
        is_registration_open=event.is_registration_open
    )


@router.get("/{event_id}", response_model=EventDetailResponse)
async def get_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get event details"""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.tenant_id == current_user.tenant_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    participant_count = db.query(EventParticipant).filter(
        EventParticipant.event_id == event.id,
        EventParticipant.status.in_(['approved', 'checked_in', 'completed'])
    ).count()
    
    # Get activities
    activities = []
    for activity in event.activities:
        activities.append(EventActivityResponse(
            **{k: v for k, v in activity.__dict__.items() if not k.startswith('_')},
            available_spots=activity.available_spots,
            is_full=activity.is_full
        ))
    
    # Get budget
    budget_response = None
    if event.event_budget:
        budget_response = EventBudgetResponse(
            **{k: v for k, v in event.event_budget.__dict__.items() if not k.startswith('_')},
            remaining_budget=event.event_budget.remaining_budget
        )
    
    # Get creator name
    creator_name = None
    if event.creator:
        creator_name = f"{event.creator.first_name} {event.creator.last_name}"
    
    return EventDetailResponse(
        **{k: v for k, v in event.__dict__.items() if not k.startswith('_')},
        participant_count=participant_count,
        is_registration_open=event.is_registration_open,
        activities=activities,
        event_budget=budget_response,
        creator_name=creator_name
    )


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: UUID,
    event_data: EventUpdate,
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db)
):
    """Update an event (Tenant Admin only)"""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.tenant_id == current_user.tenant_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    update_data = event_data.model_dump(exclude_unset=True)
    old_values = {k: str(getattr(event, k)) for k in update_data.keys()}
    
    for key, value in update_data.items():
        setattr(event, key, value)
    
    # Audit log
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="event_updated",
        entity_type="event",
        entity_id=event.id,
        old_values=old_values,
        new_values=append_impersonation_metadata({k: str(v) for k, v in update_data.items()})
    )
    db.add(audit)
    
    db.commit()
    db.refresh(event)
    
    participant_count = db.query(EventParticipant).filter(
        EventParticipant.event_id == event.id,
        EventParticipant.status.in_(['approved', 'checked_in', 'completed'])
    ).count()
    
    return EventResponse(
        **{k: v for k, v in event.__dict__.items() if not k.startswith('_')},
        participant_count=participant_count,
        is_registration_open=event.is_registration_open
    )


@router.delete("/{event_id}")
async def delete_event(
    event_id: UUID,
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db)
):
    """Delete an event (Tenant Admin only)"""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.tenant_id == current_user.tenant_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event.status in ['ongoing', 'completed']:
        raise HTTPException(status_code=400, detail="Cannot delete ongoing or completed events")
    
    db.delete(event)
    db.commit()
    
    return {"message": "Event deleted successfully"}


# =====================================================
# EVENT ACTIVITY ENDPOINTS
# =====================================================

@router.post("/{event_id}/activities", response_model=EventActivityResponse)
async def create_activity(
    event_id: UUID,
    activity_data: EventActivityCreate,
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db)
):
    """Create an activity within an event"""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.tenant_id == current_user.tenant_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    activity = EventActivity(
        tenant_id=current_user.tenant_id,
        event_id=event_id,
        **activity_data.model_dump()
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    
    return EventActivityResponse(
        **{k: v for k, v in activity.__dict__.items() if not k.startswith('_')},
        available_spots=activity.available_spots,
        is_full=activity.is_full
    )


@router.get("/{event_id}/activities", response_model=List[EventActivityResponse])
async def get_activities(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all activities for an event"""
    activities = db.query(EventActivity).filter(
        EventActivity.event_id == event_id,
        EventActivity.tenant_id == current_user.tenant_id
    ).all()
    
    return [
        EventActivityResponse(
            **{k: v for k, v in a.__dict__.items() if not k.startswith('_')},
            available_spots=a.available_spots,
            is_full=a.is_full
        )
        for a in activities
    ]


@router.put("/{event_id}/activities/{activity_id}", response_model=EventActivityResponse)
async def update_activity(
    event_id: UUID,
    activity_id: UUID,
    activity_data: EventActivityUpdate,
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db)
):
    """Update an activity"""
    activity = db.query(EventActivity).filter(
        EventActivity.id == activity_id,
        EventActivity.event_id == event_id,
        EventActivity.tenant_id == current_user.tenant_id
    ).first()
    
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    update_data = activity_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(activity, key, value)
    
    db.commit()
    db.refresh(activity)
    
    return EventActivityResponse(
        **{k: v for k, v in activity.__dict__.items() if not k.startswith('_')},
        available_spots=activity.available_spots,
        is_full=activity.is_full
    )


# =====================================================
# EVENT REGISTRATION ENDPOINTS
# =====================================================

@router.post("/{event_id}/register", response_model=EventParticipantResponse)
async def register_for_event(
    event_id: UUID,
    registration: EventRegistrationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Register for an event"""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.tenant_id == current_user.tenant_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not event.is_registration_open:
        raise HTTPException(status_code=400, detail="Registration is closed for this event")
    
    # Check if already registered
    existing = db.query(EventParticipant).filter(
        EventParticipant.event_id == event_id,
        EventParticipant.user_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Already registered for this event")
    
    # Check capacity
    if event.max_participants:
        current_count = db.query(EventParticipant).filter(
            EventParticipant.event_id == event_id,
            EventParticipant.status.in_(['pending', 'approved', 'checked_in'])
        ).count()
        if current_count >= event.max_participants:
            raise HTTPException(status_code=400, detail="Event is at full capacity")
    
    # Determine initial status based on settings
    initial_status = 'pending'
    if not event.settings.get('require_manager_approval', True):
        initial_status = 'approved'
    
    # Create participant record
    participant = EventParticipant(
        tenant_id=current_user.tenant_id,
        event_id=event_id,
        user_id=current_user.id,
        status=initial_status,
        custom_field_responses=registration.custom_field_responses
    )
    db.add(participant)
    db.flush()
    
    # Register for activities
    activity_participations = []
    for activity_id in registration.activity_ids:
        activity = db.query(EventActivity).filter(
            EventActivity.id == activity_id,
            EventActivity.event_id == event_id
        ).first()
        
        if activity and not activity.is_full:
            activity_part = ActivityParticipant(
                tenant_id=current_user.tenant_id,
                activity_id=activity_id,
                event_participant_id=participant.id
            )
            db.add(activity_part)
            activity.current_count += 1
            activity_participations.append(activity_part)
    
    # Notify manager if approval required
    if initial_status == 'pending' and current_user.manager_id:
        notification = Notification(
            tenant_id=current_user.tenant_id,
            user_id=current_user.manager_id,
            type='event_approval_required',
            title=f'Event Registration Approval Required',
            message=f'{current_user.first_name} {current_user.last_name} has requested to attend {event.name}',
            reference_type='event_participant',
            reference_id=participant.id
        )
        db.add(notification)
    
    db.commit()
    db.refresh(participant)
    
    return EventParticipantResponse(
        **{k: v for k, v in participant.__dict__.items() if not k.startswith('_')},
        user_name=f"{current_user.first_name} {current_user.last_name}",
        user_email=current_user.email,
        activities=[]
    )


@router.get("/{event_id}/participants", response_model=List[EventParticipantResponse])
async def get_participants(
    event_id: UUID,
    status: Optional[str] = None,
    current_user: User = Depends(get_tenant_lead),
    db: Session = Depends(get_db)
):
    """Get event participants (Tenant Lead or above)"""
    query = db.query(EventParticipant).filter(
        EventParticipant.event_id == event_id,
        EventParticipant.tenant_id == current_user.tenant_id
    )
    
    # If not admin, only show direct reports
    if not RolePermissions.is_tenant_admin_level(current_user.role):
        report_ids = [u.id for u in db.query(User.id).filter(User.manager_id == current_user.id).all()]
        report_ids.append(current_user.id)
        query = query.filter(EventParticipant.user_id.in_(report_ids))
    
    if status:
        query = query.filter(EventParticipant.status == status)
    
    participants = query.all()
    
    result = []
    for p in participants:
        user = db.query(User).filter(User.id == p.user_id).first()
        activities = []
        for ap in p.activity_participations:
            activity = db.query(EventActivity).filter(EventActivity.id == ap.activity_id).first()
            activities.append(ActivityParticipantResponse(
                id=ap.id,
                activity_id=ap.activity_id,
                activity_name=activity.name if activity else None,
                status=ap.status,
                checked_in_at=ap.checked_in_at,
                points_awarded=ap.points_awarded
            ))
        
        result.append(EventParticipantResponse(
            **{k: v for k, v in p.__dict__.items() if not k.startswith('_')},
            user_name=f"{user.first_name} {user.last_name}" if user else None,
            user_email=user.email if user else None,
            activities=activities
        ))
    
    return result


@router.put("/{event_id}/participants/{participant_id}/approve", response_model=EventParticipantResponse)
async def approve_participant(
    event_id: UUID,
    participant_id: UUID,
    approval: ParticipantApprovalRequest,
    current_user: User = Depends(get_tenant_lead),
    db: Session = Depends(get_db)
):
    """Approve or reject a participant (Tenant Lead or above)"""
    participant = db.query(EventParticipant).filter(
        EventParticipant.id == participant_id,
        EventParticipant.event_id == event_id,
        EventParticipant.tenant_id == current_user.tenant_id
    ).first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    
    # Verify access for non-admins
    if not RolePermissions.is_tenant_admin_level(current_user.role):
        user = db.query(User).filter(User.id == participant.user_id).first()
        if user and user.manager_id != current_user.id:
            raise HTTPException(status_code=403, detail="Can only approve your direct reports")
    
    participant.status = approval.status
    participant.approved_by = current_user.id
    participant.approved_at = datetime.utcnow()
    
    if approval.status == 'rejected':
        participant.rejection_reason = approval.rejection_reason
    
    # Notify the user
    notification = Notification(
        tenant_id=current_user.tenant_id,
        user_id=participant.user_id,
        type='event_registration_' + approval.status,
        title=f'Event Registration {approval.status.title()}',
        message=f'Your registration has been {approval.status}' + 
                (f': {approval.rejection_reason}' if approval.rejection_reason else ''),
        reference_type='event_participant',
        reference_id=participant.id
    )
    db.add(notification)
    
    db.commit()
    db.refresh(participant)
    
    user = db.query(User).filter(User.id == participant.user_id).first()
    
    return EventParticipantResponse(
        **{k: v for k, v in participant.__dict__.items() if not k.startswith('_')},
        user_name=f"{user.first_name} {user.last_name}" if user else None,
        user_email=user.email if user else None,
        activities=[]
    )


# =====================================================
# QR CHECK-IN ENDPOINTS
# =====================================================

@router.post("/{event_id}/qr-code", response_model=QRCodeResponse)
async def generate_event_qr(
    event_id: UUID,
    qr_request: QRCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate QR code for event check-in"""
    # Verify user is registered
    participant = db.query(EventParticipant).filter(
        EventParticipant.event_id == event_id,
        EventParticipant.user_id == current_user.id,
        EventParticipant.status == 'approved'
    ).first()
    
    if not participant:
        raise HTTPException(status_code=400, detail="Not registered or not approved for this event")
    
    qr_data = create_event_qr_data(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        event_id=event_id,
        activity_id=qr_request.activity_id
    )
    
    expires_at = datetime.utcnow() + timedelta(hours=24)
    
    return QRCodeResponse(
        qr_data=qr_data,
        expires_at=expires_at
    )


@router.post("/{event_id}/check-in", response_model=CheckInResponse)
async def check_in_participant(
    event_id: UUID,
    check_in: CheckInRequest,
    current_user: User = Depends(get_tenant_lead),
    db: Session = Depends(get_db)
):
    """Process QR check-in (Tenant Lead or above - event scanner)"""
    # Parse QR data
    try:
        qr_data = json.loads(check_in.qr_token)
        token = qr_data.get('t')
    except:
        token = check_in.qr_token
    
    # Verify token
    result = verify_qr_token(
        token=token,
        expected_tenant_id=current_user.tenant_id,
        expected_token_type='event_checkin'
    )
    
    if not result.valid:
        return CheckInResponse(
            success=False,
            message=result.error or "Invalid QR code"
        )
    
    # Get participant
    participant = db.query(EventParticipant).filter(
        EventParticipant.event_id == event_id,
        EventParticipant.user_id == UUID(result.payload.user_id),
        EventParticipant.status == 'approved'
    ).first()
    
    if not participant:
        return CheckInResponse(
            success=False,
            message="Participant not found or not approved"
        )
    
    # Process check-in
    participant.status = 'checked_in'
    participant.checked_in_at = datetime.utcnow()
    participant.checked_in_by = current_user.id
    
    # Check-in for specific activity if provided
    if check_in.activity_id:
        activity_part = db.query(ActivityParticipant).filter(
            ActivityParticipant.event_participant_id == participant.id,
            ActivityParticipant.activity_id == check_in.activity_id
        ).first()
        if activity_part:
            activity_part.status = 'attended'
            activity_part.checked_in_at = datetime.utcnow()
    
    db.commit()
    
    user = db.query(User).filter(User.id == participant.user_id).first()
    event = db.query(Event).filter(Event.id == event_id).first()
    
    return CheckInResponse(
        success=True,
        message="Check-in successful",
        user_name=f"{user.first_name} {user.last_name}" if user else None,
        event_name=event.name if event else None,
        checked_in_at=participant.checked_in_at
    )


# =====================================================
# EVENT BUDGET ENDPOINTS
# =====================================================

@router.post("/{event_id}/budget", response_model=EventBudgetResponse)
async def create_event_budget(
    event_id: UUID,
    budget_data: EventBudgetCreate,
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db)
):
    """Create event budget (Tenant Admin only)"""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.tenant_id == current_user.tenant_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event.event_budget:
        raise HTTPException(status_code=400, detail="Event already has a budget")
    
    budget = EventBudget(
        tenant_id=current_user.tenant_id,
        event_id=event_id,
        total_budget=budget_data.total_budget,
        breakdown=budget_data.breakdown
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    
    return EventBudgetResponse(
        **{k: v for k, v in budget.__dict__.items() if not k.startswith('_')},
        remaining_budget=budget.remaining_budget
    )


@router.get("/{event_id}/budget", response_model=EventBudgetResponse)
async def get_event_budget(
    event_id: UUID,
    current_user: User = Depends(get_tenant_lead),
    db: Session = Depends(get_db)
):
    """Get event budget"""
    budget = db.query(EventBudget).filter(
        EventBudget.event_id == event_id,
        EventBudget.tenant_id == current_user.tenant_id
    ).first()
    
    if not budget:
        raise HTTPException(status_code=404, detail="Event budget not found")
    
    return EventBudgetResponse(
        **{k: v for k, v in budget.__dict__.items() if not k.startswith('_')},
        remaining_budget=budget.remaining_budget
    )


# =====================================================
# GIFT MANAGEMENT ENDPOINTS
# =====================================================

@router.post("/{event_id}/activities/{activity_id}/gifts", response_model=GiftItemResponse)
async def create_gift_item(
    event_id: UUID,
    activity_id: UUID,
    gift_data: GiftItemCreate,
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db)
):
    """Create a gift item for an activity"""
    activity = db.query(EventActivity).filter(
        EventActivity.id == activity_id,
        EventActivity.event_id == event_id,
        EventActivity.tenant_id == current_user.tenant_id
    ).first()
    
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    gift = EventGiftItem(
        tenant_id=current_user.tenant_id,
        activity_id=activity_id,
        **gift_data.model_dump()
    )
    db.add(gift)
    db.commit()
    db.refresh(gift)
    
    return GiftItemResponse(
        **{k: v for k, v in gift.__dict__.items() if not k.startswith('_')},
        available_quantity=gift.available_quantity
    )


@router.get("/{event_id}/activities/{activity_id}/gifts", response_model=List[GiftItemResponse])
async def get_gift_items(
    event_id: UUID,
    activity_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all gift items for an activity"""
    gifts = db.query(EventGiftItem).filter(
        EventGiftItem.activity_id == activity_id,
        EventGiftItem.tenant_id == current_user.tenant_id
    ).all()
    
    return [
        GiftItemResponse(
            **{k: v for k, v in g.__dict__.items() if not k.startswith('_')},
            available_quantity=g.available_quantity
        )
        for g in gifts
    ]


@router.post("/{event_id}/gifts/{gift_id}/allocate", response_model=GiftAllocationResponse)
async def allocate_gift(
    event_id: UUID,
    gift_id: UUID,
    allocation: GiftAllocationCreate,
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db)
):
    """Allocate a gift to a user"""
    gift = db.query(EventGiftItem).filter(
        EventGiftItem.id == gift_id,
        EventGiftItem.tenant_id == current_user.tenant_id
    ).first()
    
    if not gift:
        raise HTTPException(status_code=404, detail="Gift item not found")
    
    if gift.available_quantity < allocation.quantity:
        raise HTTPException(status_code=400, detail="Insufficient gift quantity")
    
    # Verify user belongs to tenant
    user = db.query(User).filter(
        User.id == allocation.user_id,
        User.tenant_id == current_user.tenant_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create allocation
    gift_allocation = GiftAllocation(
        tenant_id=current_user.tenant_id,
        gift_item_id=gift_id,
        user_id=allocation.user_id,
        quantity=allocation.quantity,
        status='ready',
        expires_at=allocation.expires_at
    )
    
    # Generate QR token for pickup
    token = create_gift_pickup_qr_data(
        user_id=allocation.user_id,
        tenant_id=current_user.tenant_id,
        event_id=event_id,
        gift_allocation_id=gift_allocation.id
    )
    gift_allocation.qr_token_hash = hash_token(token)
    
    db.add(gift_allocation)
    
    # Update gift inventory
    gift.allocated_quantity += allocation.quantity
    
    # Notify user
    notification = Notification(
        tenant_id=current_user.tenant_id,
        user_id=allocation.user_id,
        type='gift_allocated',
        title='Gift Ready for Pickup',
        message=f'You have been allocated {allocation.quantity}x {gift.name}',
        reference_type='gift_allocation',
        reference_id=gift_allocation.id
    )
    db.add(notification)
    
    db.commit()
    db.refresh(gift_allocation)
    
    return GiftAllocationResponse(
        **{k: v for k, v in gift_allocation.__dict__.items() if not k.startswith('_')},
        gift_item_name=gift.name,
        user_name=f"{user.first_name} {user.last_name}"
    )


@router.post("/{event_id}/gifts/verify-pickup", response_model=GiftPickupResponse)
async def verify_gift_pickup(
    event_id: UUID,
    verification: GiftPickupVerification,
    current_user: User = Depends(get_tenant_lead),
    db: Session = Depends(get_db)
):
    """Verify and process gift pickup via QR code"""
    # Parse QR data
    try:
        qr_data = json.loads(verification.qr_token)
        token = qr_data.get('t')
    except:
        token = verification.qr_token
    
    # Verify token
    result = verify_qr_token(
        token=token,
        expected_tenant_id=current_user.tenant_id,
        expected_token_type='gift_pickup'
    )
    
    if not result.valid:
        return GiftPickupResponse(
            success=False,
            message=result.error or "Invalid QR code"
        )
    
    # Find allocation by user
    allocation = db.query(GiftAllocation).filter(
        GiftAllocation.user_id == UUID(result.payload.user_id),
        GiftAllocation.tenant_id == current_user.tenant_id,
        GiftAllocation.status == 'ready'
    ).first()
    
    if not allocation:
        return GiftPickupResponse(
            success=False,
            message="No pending gift allocation found"
        )
    
    # Process pickup
    allocation.status = 'picked_up'
    allocation.picked_up_at = datetime.utcnow()
    allocation.verified_by = current_user.id
    
    # Update gift distributed count
    gift = db.query(EventGiftItem).filter(EventGiftItem.id == allocation.gift_item_id).first()
    if gift:
        gift.distributed_quantity += allocation.quantity
    
    db.commit()
    
    user = db.query(User).filter(User.id == allocation.user_id).first()
    
    return GiftPickupResponse(
        success=True,
        message="Gift pickup verified successfully",
        allocation_id=allocation.id,
        user_name=f"{user.first_name} {user.last_name}" if user else None,
        gift_item_name=gift.name if gift else None,
        quantity=allocation.quantity
    )


@router.get("/my-registrations", response_model=List[EventParticipantResponse])
async def get_my_registrations(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's event registrations"""
    query = db.query(EventParticipant).filter(
        EventParticipant.user_id == current_user.id,
        EventParticipant.tenant_id == current_user.tenant_id
    )
    
    if status:
        query = query.filter(EventParticipant.status == status)
    
    participants = query.all()
    
    result = []
    for p in participants:
        event = db.query(Event).filter(Event.id == p.event_id).first()
        result.append(EventParticipantResponse(
            **{k: v for k, v in p.__dict__.items() if not k.startswith('_')},
            user_name=f"{current_user.first_name} {current_user.last_name}",
            user_email=current_user.email,
            activities=[]
        ))
    
    return result
