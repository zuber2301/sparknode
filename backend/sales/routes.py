from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List
import requests
import json
import traceback

from database import get_db
from database import SessionLocal
from models import SalesEvent, SalesEventRegistration, SalesEventLead, SalesEventMetrics, Tenant, User
from models import CRMConnector, WebhookLog
from sales.schemas import (
    SalesEventCreateRequest,
    SalesEventUpdateRequest,
    SalesEventListItem,
    RegistrationRequest,
    RegistrationResponse,
    LeadResponse,
    LeadUpdateRequest,
    MetricsResponse,
)
from auth.utils import get_current_user, require_tenant_manager_or_platform
from core.wallet_service import credit_user_wallet

router = APIRouter()


@router.post("/", response_model=SalesEventListItem)
async def create_sales_event(
    payload: SalesEventCreateRequest,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    event = SalesEvent(
        tenant_id=current_user.tenant_id,
        name=payload.name,
        description=payload.description,
        event_type=payload.event_type,
        start_at=payload.start_at,
        end_at=payload.end_at,
        location=payload.location,
        owner_user_id=payload.owner_user_id or current_user.id,
        marketing_owner_id=payload.marketing_owner_id,
        target_registrations=payload.target_registrations,
        target_pipeline=payload.target_pipeline,
        target_revenue=payload.target_revenue,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/", response_model=List[SalesEventListItem])
async def list_sales_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = db.query(SalesEvent).filter(SalesEvent.tenant_id == current_user.tenant_id).all()
    return events


@router.get("/{event_id}")
async def get_sales_event(event_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.query(SalesEvent).filter(SalesEvent.id == event_id, SalesEvent.tenant_id == current_user.tenant_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.patch("/{event_id}")
async def update_sales_event(event_id: UUID, payload: SalesEventUpdateRequest, current_user: User = Depends(require_tenant_manager_or_platform), db: Session = Depends(get_db)):
    event = db.query(SalesEvent).filter(SalesEvent.id == event_id, SalesEvent.tenant_id == current_user.tenant_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(event, k, v)
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/publish")
async def publish_sales_event(event_id: UUID, current_user: User = Depends(require_tenant_manager_or_platform), db: Session = Depends(get_db)):
    event = db.query(SalesEvent).filter(SalesEvent.id == event_id, SalesEvent.tenant_id == current_user.tenant_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = 'published'
    # Generate a registration URL placeholder
    event.registration_url = event.registration_url or f"/e/sales/{str(event.id)}"
    db.commit()
    db.refresh(event)
    return {"message": "published", "event_id": event.id, "registration_url": event.registration_url}


# Public registration endpoint
@router.post("/public/{event_id}/register", response_model=RegistrationResponse)
async def public_register(event_id: UUID, payload: RegistrationRequest, db: Session = Depends(get_db)):
    event = db.query(SalesEvent).filter(SalesEvent.id == event_id).first()
    if not event or event.status != 'published':
        raise HTTPException(status_code=404, detail="Event not available for registration")
    reg = SalesEventRegistration(
        event_id=event.id,
        email=payload.email,
        full_name=payload.full_name,
        company=payload.company,
        role=payload.role,
        source_channel=payload.source_channel,
        utm_source=payload.utm_source,
        utm_campaign=payload.utm_campaign,
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    # Create a lead tied to this registration for internal routing
    try:
        lead = SalesEventLead(
            event_id=event.id,
            registration_id=reg.id,
            owner_user_id=event.owner_user_id,
            lead_status='new'
        )
        db.add(lead)
        db.commit()
    except Exception:
        db.rollback()

    # Reward automation: credit owner if tenant configured points for registrations
    try:
        tenant = db.query(Tenant).filter(Tenant.id == event.tenant_id).first()
        points = None
        sales_settings = (tenant.settings or {}).get('sales', {}) if tenant else {}
        points = sales_settings.get('points_for_registration')
        if points and event.owner_user_id:
            owner = db.query(User).filter(User.id == event.owner_user_id).first()
            if owner:
                credit_user_wallet(db, owner, points, source='sales:registration', description='Points for registration', reference_type='sales_event', reference_id=event.id)
                db.commit()
    except Exception:
        db.rollback()

    # Trigger outbound CRM connectors in background
    # Use BackgroundTasks if available by scheduling via FastAPI; fall back to sync send.
    try:
        # Prepare payload for connectors
        connector_payload = {
            "event": "registration.created",
            "tenant_id": str(event.tenant_id),
            "event_id": str(event.id),
            "registration": {
                "id": str(reg.id),
                "email": reg.email,
                "full_name": reg.full_name,
                "company": reg.company,
                "role": reg.role,
                "registered_at": reg.registered_at.isoformat() if reg.registered_at else None
            }
        }
        # perform immediate send (synchronous) to avoid adding dependency on BackgroundTasks in signature
        send_to_connectors(event.tenant_id, 'registration.created', connector_payload)
    except Exception:
        # swallow errors but log
        traceback.print_exc()

    return reg


@router.post("/{event_id}/check-in")
async def check_in(event_id: UUID, current_user: User = Depends(require_tenant_manager_or_platform), db: Session = Depends(get_db)):
    # payload minimal for QR scan; but for now accept event_id + email in body (not implemented here)
    # This endpoint will be expanded by frontend to send registration id or email
    return {"message": "check-in endpoint placeholder"}


@router.get("/{event_id}/registrations", response_model=List[RegistrationResponse])
async def list_registrations(event_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    regs = db.query(SalesEventRegistration).filter(SalesEventRegistration.event_id == event_id).all()
    return regs


@router.get("/{event_id}/leads", response_model=List[LeadResponse])
async def list_leads(event_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    leads = db.query(SalesEventLead).filter(SalesEventLead.event_id == event_id).all()
    return leads


@router.patch("/leads/{lead_id}")
async def update_lead(lead_id: UUID, payload: LeadUpdateRequest, current_user: User = Depends(require_tenant_manager_or_platform), db: Session = Depends(get_db)):
    lead = db.query(SalesEventLead).filter(SalesEventLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(lead, k, v)
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/{event_id}/sync-crm")
async def sync_crm(event_id: UUID, current_user: User = Depends(require_tenant_manager_or_platform), db: Session = Depends(get_db)):
    # Trigger a one-off sync: push recent registrations/leads to connectors
    regs = db.query(SalesEventRegistration).filter(SalesEventRegistration.event_id == event_id).all()
    payload = {
        "event": "event.sync",
        "event_id": str(event_id),
        "registrations": [
            {"id": str(r.id), "email": r.email, "full_name": r.full_name} for r in regs
        ]
    }
    try:
        send_to_connectors(current_user.tenant_id, 'event.sync', payload)
    except Exception:
        traceback.print_exc()
    return {"message": "sync initiated"}


def send_to_connectors(tenant_id, event_type, payload):
    """Sends payload to all enabled CRM connectors for a tenant and logs responses."""
    db = SessionLocal()
    try:
        connectors = db.query(CRMConnector).filter(CRMConnector.tenant_id == tenant_id, CRMConnector.enabled == True).all()
        for c in connectors:
            url = None
            try:
                cfg = c.config or {}
                url = cfg.get('webhook_url') or cfg.get('url')
                headers = cfg.get('headers') or {"Content-Type": "application/json"}
                if not url:
                    # nothing to send
                    continue
                resp = requests.post(url, json=payload, headers=headers, timeout=5)
                body = resp.text
                status = resp.status_code
            except Exception as e:
                body = str(e)
                status = None
            try:
                log = WebhookLog(
                    tenant_id=tenant_id,
                    connector_id=c.id,
                    event_type=event_type,
                    payload=payload,
                    response_status=status,
                    response_body=body
                )
                db.add(log)
                db.commit()
            except Exception:
                db.rollback()
    finally:
        db.close()


@router.get("/{event_id}/metrics", response_model=MetricsResponse)
async def get_metrics(event_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    metrics = db.query(SalesEventMetrics).filter(SalesEventMetrics.event_id == event_id).first()
    if not metrics:
        # return zeroed metrics if none exist
        return MetricsResponse(
            event_id=event_id,
            registrations=0,
            attendees=0,
            meetings_booked=0,
            opportunities=0,
            pipeline_value=0,
            revenue_closed=0,
        )
    return metrics


@router.get("/metrics/summary")
async def metrics_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Simple summary across tenant events
    rows = db.query(SalesEventMetrics).join(SalesEvent, SalesEventMetrics.event_id == SalesEvent.id).filter(SalesEvent.tenant_id == current_user.tenant_id).all()
    summary = []
    for r in rows:
        summary.append({
            "event_id": r.event_id,
            "registrations": r.registrations,
            "attendees": r.attendees,
            "meetings_booked": r.meetings_booked,
            "opportunities": r.opportunities,
            "pipeline_value": r.pipeline_value,
            "revenue_closed": r.revenue_closed,
        })
    return {"summary": summary}
