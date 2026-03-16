"""
Experience / Growth Events — Routes
=====================================
Pro feature: lead-capture event pages for sales & marketing campaigns.

Endpoints:
  POST   /api/experience/growth/events                          — Admin: create event
  GET    /api/experience/growth/events                          — Admin: list events
  PUT    /api/experience/growth/events/{event_id}               — Admin: update event
  DELETE /api/experience/growth/events/{event_id}               — Admin: delete event
  GET    /api/experience/growth/events/{event_id}/registrations — Admin: list leads (JSON)
  GET    /api/experience/growth/events/{event_id}/registrations/csv — Admin: export CSV
  GET    /api/experience/growth/events/public/{slug}            — PUBLIC: registration page data
  POST   /api/experience/growth/events/public/{slug}/register   — PUBLIC: submit lead
"""

from __future__ import annotations

import csv
import hashlib
import io
import re
import uuid as _uuid

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth.utils import get_current_user
from database import get_db
from models import User, GrowthEvent, GrowthEventRegistration, GrowthEventStatus

router = APIRouter()

ADMIN_ROLES = {"tenant_manager", "hr_admin", "platform_admin"}


def _require_admin(user: User) -> None:
    if user.org_role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug[:100]


def _event_view(event: GrowthEvent) -> dict:
    reg_count = len(event.registrations) if event.registrations else 0
    return {
        "id": str(event.id),
        "title": event.title,
        "slug": event.slug,
        "description": event.description,
        "event_date": event.event_date.isoformat() if event.event_date else None,
        "location": event.location,
        "timezone": event.timezone_str,
        "banner_url": event.banner_url,
        "registration_schema": event.registration_schema or [],
        "status": event.status.value if hasattr(event.status, "value") else event.status,
        "registration_count": reg_count,
        "max_registrations": event.max_registrations,
        "is_full": (
            event.max_registrations is not None and reg_count >= event.max_registrations
        ),
        "created_at": event.created_at.isoformat() if event.created_at else None,
    }


# ─── admin endpoints ─────────────────────────────────────────────────────────

@router.post("/growth/events", status_code=201)
def create_growth_event(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: create a new growth event with a unique slug."""
    _require_admin(current_user)

    title = str(body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="title is required")

    # Auto-generate unique slug
    base_slug = _slugify(title)
    slug = base_slug
    counter = 1
    while db.query(GrowthEvent).filter(GrowthEvent.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    event_date = None
    raw_date = body.get("event_date")
    if raw_date:
        try:
            event_date = datetime.fromisoformat(str(raw_date))
        except (ValueError, TypeError):
            pass

    event = GrowthEvent(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        title=title,
        slug=slug,
        description=body.get("description"),
        event_date=event_date,
        location=body.get("location"),
        timezone_str=body.get("timezone") or "UTC",
        status=GrowthEventStatus.DRAFT,
        registration_schema=body.get("registration_schema") or [],
        max_registrations=body.get("max_registrations"),
        banner_url=body.get("banner_url"),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _event_view(event)


@router.get("/growth/events")
def list_growth_events(
    status: Optional[str] = Query(None, description="draft|published|closed"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: list growth events. Platform admin sees all; tenant admin sees own."""
    _require_admin(current_user)

    q = db.query(GrowthEvent)
    if current_user.org_role != "platform_admin":
        q = q.filter(GrowthEvent.tenant_id == current_user.tenant_id)
    if status:
        try:
            q = q.filter(GrowthEvent.status == GrowthEventStatus(status))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status}")

    events = q.order_by(GrowthEvent.created_at.desc()).all()
    return [_event_view(e) for e in events]


@router.put("/growth/events/{event_id}")
def update_growth_event(
    event_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: update a growth event."""
    _require_admin(current_user)
    event = db.query(GrowthEvent).filter(GrowthEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if current_user.org_role != "platform_admin" and event.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Not your event")

    for field in ("title", "description", "location", "banner_url", "max_registrations"):
        if field in body:
            setattr(event, field, body[field])

    if "event_date" in body and body["event_date"]:
        try:
            event.event_date = datetime.fromisoformat(str(body["event_date"]))
        except (ValueError, TypeError):
            pass

    if "status" in body:
        try:
            event.status = GrowthEventStatus(body["status"])
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status: {body['status']}")

    if "registration_schema" in body:
        event.registration_schema = body["registration_schema"]
    if "timezone" in body:
        event.timezone_str = body["timezone"]

    db.commit()
    db.refresh(event)
    return _event_view(event)


@router.delete("/growth/events/{event_id}", status_code=204)
def delete_growth_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: delete a growth event (also deletes all registrations via CASCADE)."""
    _require_admin(current_user)
    event = db.query(GrowthEvent).filter(GrowthEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if current_user.org_role != "platform_admin" and event.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Not your event")
    db.delete(event)
    db.commit()


@router.get("/growth/events/{event_id}/registrations")
def get_event_registrations(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: list all lead registrations for an event as JSON."""
    _require_admin(current_user)
    event = db.query(GrowthEvent).filter(GrowthEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if current_user.org_role != "platform_admin" and event.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Not your event")

    return [
        {
            "id": str(r.id),
            "name": r.name,
            "email": r.email,
            "company": r.company,
            "phone": r.phone,
            "extra_fields": r.extra_fields,
            "registered_at": r.registered_at.isoformat() if r.registered_at else None,
            "utm_source": r.utm_source,
            "utm_medium": r.utm_medium,
            "utm_campaign": r.utm_campaign,
        }
        for r in event.registrations
    ]


@router.get("/growth/events/{event_id}/registrations/csv")
def export_registrations_csv(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: download all leads as a CSV file."""
    _require_admin(current_user)
    event = db.query(GrowthEvent).filter(GrowthEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if current_user.org_role != "platform_admin" and event.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Not your event")

    buf = io.StringIO()
    writer = csv.DictWriter(
        buf,
        fieldnames=["name", "email", "company", "phone", "registered_at", "utm_source", "utm_medium", "utm_campaign"],
        extrasaction="ignore",
    )
    writer.writeheader()
    for r in event.registrations:
        writer.writerow(
            {
                "name": r.name,
                "email": r.email,
                "company": r.company or "",
                "phone": r.phone or "",
                "registered_at": r.registered_at.isoformat() if r.registered_at else "",
                "utm_source": r.utm_source or "",
                "utm_medium": r.utm_medium or "",
                "utm_campaign": r.utm_campaign or "",
            }
        )
    buf.seek(0)
    filename = f"registrations_{event.slug}.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(buf, media_type="text/csv", headers=headers)


# ─── public endpoints (no authentication required) ───────────────────────────

@router.get("/growth/events/public/{slug}")
def get_event_public(
    slug: str,
    db: Session = Depends(get_db),
):
    """
    PUBLIC (no auth): return event details for the registration page.
    Only returns published events.
    """
    event = (
        db.query(GrowthEvent)
        .filter(
            GrowthEvent.slug == slug,
            GrowthEvent.status == GrowthEventStatus.PUBLISHED,
        )
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _event_view(event)


@router.post("/growth/events/public/{slug}/register", status_code=201)
def register_for_event(
    slug: str,
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    PUBLIC (no auth): submit a registration for a growth event.

    Required body: { name, email }
    Optional: { company, phone, utm_source, utm_medium, utm_campaign, ...schema_fields }

    Security:
    - Client IP is SHA-256 hashed (never stored plain)
    - Duplicate email per event is rejected (409)
    - Required registration_schema fields are validated
    """
    event = (
        db.query(GrowthEvent)
        .filter(
            GrowthEvent.slug == slug,
            GrowthEvent.status == GrowthEventStatus.PUBLISHED,
        )
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    reg_count = (
        db.query(GrowthEventRegistration)
        .filter(GrowthEventRegistration.event_id == event.id)
        .count()
    )
    if event.max_registrations and reg_count >= event.max_registrations:
        raise HTTPException(status_code=409, detail="Event is full")

    # Validate required fields from dynamic schema
    schema = event.registration_schema or []
    for field_def in schema:
        if field_def.get("required") and not body.get(field_def.get("field", "")):
            label = field_def.get("label") or field_def.get("field", "field")
            raise HTTPException(status_code=422, detail=f"'{label}' is required")

    name = str(body.get("name") or "").strip()
    email = str(body.get("email") or "").strip().lower()

    if not name:
        raise HTTPException(status_code=422, detail="name is required")
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="Valid email address is required")

    # Reject duplicate email registration for the same event
    if (
        db.query(GrowthEventRegistration)
        .filter(
            GrowthEventRegistration.event_id == event.id,
            GrowthEventRegistration.email == email,
        )
        .first()
    ):
        raise HTTPException(status_code=409, detail="Already registered with this email")

    # Hash IP address — do not store plain
    client_ip = (request.client.host if request.client else "") or "unknown"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()

    # Collect extra fields (anything not in the known set)
    known = {"name", "email", "company", "phone", "utm_source", "utm_medium", "utm_campaign"}
    extra = {k: v for k, v in body.items() if k not in known} or None

    reg = GrowthEventRegistration(
        event_id=event.id,
        name=name,
        email=email,
        company=body.get("company"),
        phone=body.get("phone"),
        extra_fields=extra,
        utm_source=body.get("utm_source"),
        utm_medium=body.get("utm_medium"),
        utm_campaign=body.get("utm_campaign"),
        ip_hash=ip_hash,
    )
    db.add(reg)
    db.commit()

    return {
        "ok": True,
        "message": f"You're registered for {event.title}!",
        "event_title": event.title,
        "event_date": event.event_date.isoformat() if event.event_date else None,
        "location": event.location,
    }
