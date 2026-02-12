"""
Event Management Routes for SparkNode Events Hub.
Includes endpoints for event CRUD, activity management, nominations, teams, gifts, and metrics.
All endpoints are tenant-scoped for multi-tenant isolation.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from uuid import UUID
from typing import List, Optional

from database import get_db
from auth.utils import get_current_user, get_hr_admin, get_event_admin
from models import User, Event, EventActivity, EventNomination, EventTeam, EventTeamMember, EventGiftBatch, EventGiftRedemption, EventBudget, EventMetrics
from events.schemas import (
    EventCreate, EventUpdate, EventDetailResponse, EventListResponse,
    EventActivityCreate, EventActivityUpdate, EventActivityResponse,
    EventNominationCreate, EventNominationUpdate, EventNominationResponse,
    EventTeamCreate, EventTeamResponse, EventTeamMemberResponse,
    EventGiftBatchCreate, EventGiftBatchResponse,
    EventBudgetResponse, EventMetricsResponse,
    EventTemplateGalleryResponse, EventTemplate,
    BulkNominationApprovalRequest
)

router = APIRouter()

# =====================================================
# EVENT TEMPLATES (Gallery)
# =====================================================

@router.get("/templates", response_model=EventTemplateGalleryResponse, tags=["Events"])
async def get_event_templates(db: Session = Depends(get_db)):
    """Get list of event templates for quick event creation."""
    templates = [
        EventTemplate(
            id="annual_day",
            name="Annual Day",
            description="Company celebration with awards, performances, and activities",
            icon="🎉",
            preset_activities=[
                {"name": "Singing", "category": "solo", "requires_approval": True},
                {"name": "Dancing", "category": "solo", "requires_approval": True},
                {"name": "Standup Comedy", "category": "solo", "requires_approval": True},
                {"name": "Band Performance", "category": "group", "min_team_size": 2, "max_team_size": 5},
                {"name": "Skit/Play", "category": "group", "min_team_size": 3, "max_team_size": 10},
                {"name": "Gift Distribution", "category": "other"},
            ],
            rules={
                "max_activities_per_person": 2,
                "who_can_nominate": "all_employees",
                "requires_approval": True,
            }
        ),
        EventTemplate(
            id="gift_distribution",
            name="Gift Distribution",
            description="Campaign for distributing gifts, hampers, or vouchers",
            icon="🎁",
            preset_activities=[
                {"name": "Gift Pickup", "category": "other", "max_participants": None},
            ],
            rules={
                "visibility": "all_employees",
                "distribution_method": "qr_code",
                "one_gift_per_employee": True,
            }
        ),
        EventTemplate(
            id="sports_day",
            name="Sports Day",
            description="Inter-departmental sports competition",
            icon="⚽",
            preset_activities=[
                {"name": "Cricket", "category": "group", "min_team_size": 11, "max_team_size": 15},
                {"name": "Football", "category": "group", "min_team_size": 11, "max_team_size": 15},
                {"name": "Badminton", "category": "group", "min_team_size": 2, "max_team_size": 2},
                {"name": "Table Tennis", "category": "solo"},
                {"name": "Relay Race", "category": "group", "min_team_size": 4, "max_team_size": 4},
            ],
            rules={
                "max_activities_per_person": 3,
                "allow_multiple_teams": False,
                "team_registration_required": True,
            }
        ),
        EventTemplate(
            id="townhall",
            name="Townhall/Q&A",
            description="Company townhall with Q&A session",
            icon="🎤",
            preset_activities=[
                {"name": "Q&A Submission", "category": "other"},
            ],
            rules={
                "visibility": "all_employees",
            }
        ),
        EventTemplate(
            id="hackathon",
            name="Hackathon",
            description="Innovation/coding hackathon event",
            icon="💡",
            preset_activities=[
                {"name": "Idea Pitch", "category": "group", "min_team_size": 1, "max_team_size": 5},
            ],
            rules={
                "team_registration_required": True,
            }
        ),
    ]
    return EventTemplateGalleryResponse(templates=templates)


# =====================================================
# EVENT CRUD
# =====================================================

@router.post("/", response_model=EventDetailResponse, tags=["Events"])
async def create_event(
    event: EventCreate,
    current_user: User = Depends(get_event_admin),
    db: Session = Depends(get_db),
):
    """Create a new event (Tenant Manager only)."""
    # TODO: Check if user is Tenant Manager
    
    # Convert visible_to_departments UUIDs to strings for JSON serialization
    visible_departments = []
    if event.visible_to_departments:
        visible_departments = [str(dept_id) for dept_id in event.visible_to_departments]
    
    new_event = Event(
        tenant_id=current_user.tenant_id,
        title=event.title,
        description=event.description,
        type=event.type,
        start_datetime=event.start_datetime,
        end_datetime=event.end_datetime,
        venue=event.venue,
        location=event.location,
        format=event.format,
        banner_url=event.banner_url,
        color_code=event.color_code,
        status=event.status,
        visibility=event.visibility,
        visible_to_departments=visible_departments,
        nomination_start=event.nomination_start,
        nomination_end=event.nomination_end,
        who_can_nominate=event.who_can_nominate,
        max_activities_per_person=event.max_activities_per_person,
        planned_budget=event.planned_budget,
        currency=event.currency,
        created_by=current_user.id,
    )
    
    db.add(new_event)
    db.flush()
    
    # Create associated budget and metrics records
    budget = EventBudget(
        event_id=new_event.id,
        tenant_id=current_user.tenant_id,
        planned_budget=event.planned_budget,
    )
    metrics = EventMetrics(
        event_id=new_event.id,
        tenant_id=current_user.tenant_id,
    )
    db.add(budget)
    db.add(metrics)
    db.commit()
    db.refresh(new_event)
    
    return EventDetailResponse.model_validate(new_event)


@router.get("/", response_model=List[EventListResponse], tags=["Events"])
async def list_events(
    status: Optional[str] = Query(None, description="Filter by status: draft, published, ongoing, closed"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all events for a tenant."""
    query = db.query(Event).filter(Event.tenant_id == current_user.tenant_id)
    
    if status:
        query = query.filter(Event.status == status)
    
    events = query.order_by(Event.start_datetime.desc()).offset(skip).limit(limit).all()
    
    result = []
    for event in events:
        activity_count = db.query(EventActivity).filter(EventActivity.event_id == event.id).count()
        nomination_count = db.query(EventNomination).filter(EventNomination.event_id == event.id).count()
        
        event_data = EventListResponse.model_validate(event)
        event_data.activity_count = activity_count
        event_data.nomination_count = nomination_count
        result.append(event_data)
    
    return result


@router.get("/{event_id}", response_model=EventDetailResponse, tags=["Events"])
async def get_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get event details."""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.tenant_id == current_user.tenant_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    activity_count = db.query(EventActivity).filter(EventActivity.event_id == event.id).count()
    nomination_count = db.query(EventNomination).filter(EventNomination.event_id == event.id).count()
    
    event_data = EventDetailResponse.model_validate(event)
    event_data.activity_count = activity_count
    event_data.nomination_count = nomination_count
    
    return event_data


@router.put("/{event_id}", response_model=EventDetailResponse, tags=["Events"])
async def update_event(
    event_id: UUID,
    event_update: EventUpdate,
    current_user: User = Depends(get_event_admin),
    db: Session = Depends(get_db),
):
    """Update an event."""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.tenant_id == current_user.tenant_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Update fields if provided
    update_data = event_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)
    
    event.updated_at = datetime.now()
    db.commit()
    db.refresh(event)
    
    return EventDetailResponse.model_validate(event)


@router.delete("/{event_id}", tags=["Events"])
async def delete_event(
    event_id: UUID,
    current_user: User = Depends(get_event_admin),
    db: Session = Depends(get_db),
):
    """Delete an event (Tenant Manager only)."""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.tenant_id == current_user.tenant_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    db.delete(event)
    db.commit()
    
    return {"success": True, "message": "Event deleted"}


# =====================================================
# EVENT ACTIVITIES
# =====================================================

@router.post("/{event_id}/activities", response_model=EventActivityResponse, tags=["Event Activities"])
async def create_activity(
    event_id: UUID,
    activity: EventActivityCreate,
    current_user: User = Depends(get_event_admin),
    db: Session = Depends(get_db),
):
    """Create an activity for an event."""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.tenant_id == current_user.tenant_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    new_activity = EventActivity(
        event_id=event_id,
        tenant_id=current_user.tenant_id,
        name=activity.name,
        description=activity.description,
        category=activity.category,
        max_participants=activity.max_participants,
        max_teams=activity.max_teams,
        min_team_size=activity.min_team_size,
        max_team_size=activity.max_team_size,
        nomination_start=activity.nomination_start,
        nomination_end=activity.nomination_end,
        activity_start=activity.activity_start,
        activity_end=activity.activity_end,
        requires_approval=activity.requires_approval,
        allow_multiple_teams=activity.allow_multiple_teams,
        rules_text=activity.rules_text,
        sequence=activity.sequence,
    )
    
    db.add(new_activity)
    db.commit()
    db.refresh(new_activity)
    
    return EventActivityResponse.model_validate(new_activity)


@router.get("/{event_id}/activities", response_model=List[EventActivityResponse], tags=["Event Activities"])
async def list_activities(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all activities for an event."""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.tenant_id == current_user.tenant_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    activities = db.query(EventActivity).filter(
        EventActivity.event_id == event_id
    ).order_by(EventActivity.sequence).all()
    
    result = []
    for activity in activities:
        nomination_count = db.query(EventNomination).filter(EventNomination.activity_id == activity.id).count()
        approved_count = db.query(EventNomination).filter(
            EventNomination.activity_id == activity.id,
            EventNomination.status == 'approved'
        ).count()
        waitlisted_count = db.query(EventNomination).filter(
            EventNomination.activity_id == activity.id,
            EventNomination.status == 'waitlisted'
        ).count()
        team_count = db.query(EventTeam).filter(EventTeam.activity_id == activity.id).count()
        
        activity_data = EventActivityResponse.model_validate(activity)
        activity_data.nomination_count = nomination_count
        activity_data.approved_count = approved_count
        activity_data.waitlisted_count = waitlisted_count
        activity_data.team_count = team_count
        result.append(activity_data)
    
    return result


@router.put("/{event_id}/activities/{activity_id}", response_model=EventActivityResponse, tags=["Event Activities"])
async def update_activity(
    event_id: UUID,
    activity_id: UUID,
    activity_update: EventActivityUpdate,
    current_user: User = Depends(get_event_admin),
    db: Session = Depends(get_db),
):
    """Update an activity."""
    activity = db.query(EventActivity).filter(
        EventActivity.id == activity_id,
        EventActivity.event_id == event_id,
        EventActivity.tenant_id == current_user.tenant_id
    ).first()
    
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    update_data = activity_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(activity, field, value)
    
    activity.updated_at = datetime.now()
    db.commit()
    db.refresh(activity)
    
    return EventActivityResponse.model_validate(activity)


@router.delete("/{event_id}/activities/{activity_id}", tags=["Event Activities"])
async def delete_activity(
    event_id: UUID,
    activity_id: UUID,
    current_user: User = Depends(get_event_admin),
    db: Session = Depends(get_db),
):
    """Delete an activity."""
    activity = db.query(EventActivity).filter(
        EventActivity.id == activity_id,
        EventActivity.event_id == event_id,
        EventActivity.tenant_id == current_user.tenant_id
    ).first()
    
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    db.delete(activity)
    db.commit()
    
    return {"success": True, "message": "Activity deleted"}


# =====================================================
# EVENT NOMINATIONS
# =====================================================

@router.post("/{event_id}/activities/{activity_id}/nominate", response_model=EventNominationResponse, tags=["Nominations"])
async def create_nomination(
    event_id: UUID,
    activity_id: UUID,
    nomination: EventNominationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a nomination for an activity."""
    activity = db.query(EventActivity).filter(
        EventActivity.id == activity_id,
        EventActivity.event_id == event_id,
        EventActivity.tenant_id == current_user.tenant_id
    ).first()
    
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    # Check if nomination window is open
    now = datetime.now()
    if activity.nomination_start and now < activity.nomination_start:
        raise HTTPException(status_code=400, detail="Nomination hasn't started yet")
    if activity.nomination_end and now > activity.nomination_end:
        raise HTTPException(status_code=400, detail="Nomination period has ended")
    
    new_nomination = EventNomination(
        event_id=event_id,
        activity_id=activity_id,
        tenant_id=current_user.tenant_id,
        nominee_user_id=nomination.nominee_user_id,
        team_id=nomination.team_id,
        created_by=current_user.id,
        performance_title=nomination.performance_title,
        notes=nomination.notes,
        preferred_slot=nomination.preferred_slot,
        status='approved' if not activity.requires_approval else 'pending',
    )
    
    db.add(new_nomination)
    db.commit()
    db.refresh(new_nomination)
    
    return EventNominationResponse.model_validate(new_nomination)


@router.get("/{event_id}/nominations", response_model=List[EventNominationResponse], tags=["Nominations"])
async def list_nominations(
    event_id: UUID,
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List nominations for an event."""
    query = db.query(EventNomination).filter(
        EventNomination.event_id == event_id,
        EventNomination.tenant_id == current_user.tenant_id
    )
    
    if status:
        query = query.filter(EventNomination.status == status)
    
    nominations = query.all()
    return [EventNominationResponse.model_validate(n) for n in nominations]


@router.put("/{event_id}/nominations/{nomination_id}/approve", response_model=EventNominationResponse, tags=["Nominations"])
async def approve_nomination(
    event_id: UUID,
    nomination_id: UUID,
    update_data: EventNominationUpdate,
    current_user: User = Depends(get_event_admin),
    db: Session = Depends(get_db),
):
    """Approve or reject a nomination (Admin only)."""
    nomination = db.query(EventNomination).filter(
        EventNomination.id == nomination_id,
        EventNomination.event_id == event_id,
        EventNomination.tenant_id == current_user.tenant_id
    ).first()
    
    if not nomination:
        raise HTTPException(status_code=404, detail="Nomination not found")
    
    nomination.status = update_data.status or nomination.status
    nomination.notes = update_data.notes or nomination.notes
    nomination.reviewed_by = current_user.id
    nomination.reviewed_at = datetime.now()
    
    db.commit()
    db.refresh(nomination)
    
    return EventNominationResponse.model_validate(nomination)


@router.post("/nominations/bulk-approve", tags=["Nominations"])
async def bulk_approve_nominations(
    bulk_request: BulkNominationApprovalRequest,
    current_user: User = Depends(get_event_admin),
    db: Session = Depends(get_db),
):
    """Bulk approve/reject nominations."""
    nominations = db.query(EventNomination).filter(
        EventNomination.id.in_(bulk_request.nomination_ids),
        EventNomination.tenant_id == current_user.tenant_id
    ).all()
    
    updated_count = 0
    for nomination in nominations:
        nomination.status = bulk_request.status
        nomination.reviewed_by = current_user.id
        nomination.reviewed_at = datetime.now()
        updated_count += 1
    
    db.commit()
    
    return {
        "success": True,
        "updated_count": updated_count,
        "message": f"Updated {updated_count} nominations"
    }


# =====================================================
# EVENT METRICS
# =====================================================

@router.get("/{event_id}/metrics", response_model=EventMetricsResponse, tags=["Metrics"])
async def get_event_metrics(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get event participation and analytics metrics."""
    metrics = db.query(EventMetrics).filter(
        EventMetrics.event_id == event_id,
        EventMetrics.tenant_id == current_user.tenant_id
    ).first()
    
    if not metrics:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Recompute metrics
    event = db.query(Event).filter(Event.id == event_id).first()
    
    # Count registrations and activities
    total_registered = db.query(EventNomination).filter(
        EventNomination.event_id == event_id
    ).distinct(EventNomination.nominee_user_id).count()
    
    total_activities = db.query(EventActivity).filter(
        EventActivity.event_id == event_id
    ).count()
    
    # Build activity metrics
    activity_metrics = {}
    activities = db.query(EventActivity).filter(EventActivity.event_id == event_id).all()
    for activity in activities:
        nom_count = db.query(EventNomination).filter(
            EventNomination.activity_id == activity.id
        ).count()
        approved = db.query(EventNomination).filter(
            EventNomination.activity_id == activity.id,
            EventNomination.status == 'approved'
        ).count()
        
        activity_metrics[str(activity.id)] = {
            "name": activity.name,
            "nominations": nom_count,
            "approved": approved,
        }
    
    metrics.total_registered = total_registered
    metrics.activity_metrics = activity_metrics
    metrics.computed_at = datetime.now()
    
    db.commit()
    
    return EventMetricsResponse.model_validate(metrics)

