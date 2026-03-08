"""
Sales Campaign / Exhibition Routes
====================================
Campaigns are exhibition/booth events with escrow-based instant payout.

Role access summary:
  POST   /campaigns/                    → tenant_manager (create & submit draft)
  GET    /campaigns/                    → all authed users (scoped to tenant)
  GET    /campaigns/{id}                → all authed users
  PATCH  /campaigns/{id}               → tenant_manager (edit while draft)
  POST   /campaigns/{id}/submit        → tenant_manager (draft → pending_approval)
  POST   /campaigns/{id}/approve       → tenant_manager (pending → active + escrow)
  POST   /campaigns/{id}/reject        → tenant_manager
  POST   /campaigns/{id}/participants  → tenant_manager
  POST   /campaigns/{id}/register-lead → any authenticated user (booth rep)
  GET    /campaigns/{id}/leads         → tenant_manager / dept_lead
  GET    /campaigns/{id}/leaderboard   → all authed users
"""

import hashlib
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from auth.utils import get_current_user, require_tenant_manager_or_platform
from core.wallet_service import credit_user_wallet
from database import get_db
from models import (
    CampaignParticipant,
    LeadRegistration,
    MasterBudgetLedger,
    SalesCampaign,
    Tenant,
    User,
    Wallet,
    WalletLedger,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Pydantic schemas ────────────────────────────────────────────────────────

class CampaignCreateRequest(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    venue: Optional[str] = None
    campaign_type: str = "exhibition"
    start_date: datetime
    end_date: datetime
    points_per_lead: int = Field(50, ge=1)
    max_leads_per_rep: Optional[int] = None
    total_budget_requested: int = Field(..., ge=1)
    participant_ids: Optional[List[UUID]] = []

    @validator("end_date")
    def end_after_start(cls, v, values):
        if "start_date" in values and v <= values["start_date"]:
            raise ValueError("end_date must be after start_date")
        return v


class CampaignUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    venue: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    points_per_lead: Optional[int] = None
    max_leads_per_rep: Optional[int] = None
    total_budget_requested: Optional[int] = None


class EscrowApprovalRequest(BaseModel):
    approved: bool
    rejection_reason: Optional[str] = None


class ParticipantAddRequest(BaseModel):
    user_ids: List[UUID]
    role: str = "rep"


class LeadCaptureRequest(BaseModel):
    visitor_name: str = Field(..., min_length=1, max_length=255)
    visitor_email: Optional[str] = None
    visitor_phone: Optional[str] = None
    interest_level: str = "medium"
    notes: Optional[str] = None

    @validator("visitor_email", "visitor_phone", pre=True)
    def at_least_one_contact(cls, v):
        return v  # cross-field validation below

    def contact_hash(self) -> str:
        """SHA-256 of the best available contact identifier (normalised)."""
        identifier = (self.visitor_email or "").strip().lower() or \
                     (self.visitor_phone or "").strip()
        if not identifier:
            raise ValueError("visitor_email or visitor_phone is required")
        return hashlib.sha256(identifier.encode()).hexdigest()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_campaign_or_404(db: Session, campaign_id: UUID, tenant_id: UUID) -> SalesCampaign:
    c = db.query(SalesCampaign).filter(
        SalesCampaign.id == campaign_id,
        SalesCampaign.tenant_id == tenant_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return c


def _campaign_response(c: SalesCampaign) -> dict:
    return {
        "id": str(c.id),
        "tenant_id": str(c.tenant_id),
        "created_by": str(c.created_by),
        "title": c.title,
        "description": c.description,
        "venue": c.venue,
        "campaign_type": c.campaign_type,
        "start_date": c.start_date.isoformat() if c.start_date else None,
        "end_date": c.end_date.isoformat() if c.end_date else None,
        "points_per_lead": float(c.points_per_lead),
        "max_leads_per_rep": c.max_leads_per_rep,
        "total_budget_requested": float(c.total_budget_requested),
        "budget_escrow": float(c.budget_escrow),
        "leads_rewarded": c.leads_rewarded,
        "points_disbursed": float(c.points_disbursed),
        "status": c.status,
        "approved_by": str(c.approved_by) if c.approved_by else None,
        "approved_at": c.approved_at.isoformat() if c.approved_at else None,
        "rejection_reason": c.rejection_reason,
        "swept_at": c.swept_at.isoformat() if c.swept_at else None,
        "swept_amount": float(c.swept_amount) if c.swept_amount is not None else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "participants": [
            {"user_id": str(p.user_id), "role": p.role}
            for p in (c.participants or [])
        ],
    }


# ─── CRUD ────────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def create_campaign(
    payload: CampaignCreateRequest,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    """Create a draft campaign (Marketing Admin / Tenant Manager)."""
    campaign = SalesCampaign(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        title=payload.title,
        description=payload.description,
        venue=payload.venue,
        campaign_type=payload.campaign_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        points_per_lead=payload.points_per_lead,
        max_leads_per_rep=payload.max_leads_per_rep,
        total_budget_requested=payload.total_budget_requested,
        status="draft",
    )
    db.add(campaign)
    db.flush()

    # Add creator as lead participant
    db.add(CampaignParticipant(
        campaign_id=campaign.id,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        role="lead",
    ))

    # Add additional participants
    for uid in (payload.participant_ids or []):
        if uid != current_user.id:
            db.add(CampaignParticipant(
                campaign_id=campaign.id,
                user_id=uid,
                tenant_id=current_user.tenant_id,
                role="rep",
            ))

    db.commit()
    db.refresh(campaign)
    return _campaign_response(campaign)


@router.get("/")
async def list_campaigns(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all campaigns for the tenant (scoped by role)."""
    query = db.query(SalesCampaign).filter(SalesCampaign.tenant_id == current_user.tenant_id)

    # Sales reps only see campaigns they are assigned to
    if current_user.org_role == "tenant_user":
        sub = db.query(CampaignParticipant.campaign_id).filter(
            CampaignParticipant.user_id == current_user.id
        ).subquery()
        query = query.filter(SalesCampaign.id.in_(sub))

    campaigns = query.order_by(SalesCampaign.created_at.desc()).all()
    return [_campaign_response(c) for c in campaigns]


@router.get("/pending-approvals")
async def list_pending_approvals(
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    """List campaigns awaiting escrow approval (Tenant Manager view)."""
    campaigns = db.query(SalesCampaign).filter(
        SalesCampaign.tenant_id == current_user.tenant_id,
        SalesCampaign.status == "pending_approval",
    ).order_by(SalesCampaign.created_at.desc()).all()
    return [_campaign_response(c) for c in campaigns]


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = _get_campaign_or_404(db, campaign_id, current_user.tenant_id)
    return _campaign_response(c)


@router.patch("/{campaign_id}")
async def update_campaign(
    campaign_id: UUID,
    payload: CampaignUpdateRequest,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    c = _get_campaign_or_404(db, campaign_id, current_user.tenant_id)
    if c.status not in ("draft", "pending_approval"):
        raise HTTPException(status_code=400, detail="Only draft/pending campaigns can be edited")

    for field, val in payload.dict(exclude_none=True).items():
        setattr(c, field, val)
    db.commit()
    db.refresh(c)
    return _campaign_response(c)


# ─── Workflow transitions ─────────────────────────────────────────────────────

@router.post("/{campaign_id}/submit")
async def submit_for_approval(
    campaign_id: UUID,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    """Move campaign from draft → pending_approval."""
    c = _get_campaign_or_404(db, campaign_id, current_user.tenant_id)
    if c.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft campaigns can be submitted")
    c.status = "pending_approval"
    db.commit()
    db.refresh(c)
    return _campaign_response(c)


@router.post("/{campaign_id}/approve")
async def approve_campaign(
    campaign_id: UUID,
    payload: EscrowApprovalRequest,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    """
    Tenant Manager approves or rejects a pending campaign.

    On approval: moves `total_budget_requested` points from the tenant's
    master_budget_balance into the campaign's budget_escrow.
    """
    c = _get_campaign_or_404(db, campaign_id, current_user.tenant_id)
    if c.status != "pending_approval":
        raise HTTPException(status_code=400, detail="Campaign is not pending approval")

    if not payload.approved:
        c.status = "draft"  # bounce back to draft so creator can revise
        c.rejection_reason = payload.rejection_reason
        db.commit()
        db.refresh(c)
        return _campaign_response(c)

    # ── Escrow transfer ──────────────────────────────────────────────────
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).with_for_update().first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    requested = Decimal(str(c.total_budget_requested))
    if tenant.master_budget_balance < requested:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient master pool balance. "
                   f"Available: {tenant.master_budget_balance}, Requested: {requested}",
        )

    # Deduct from master pool
    tenant.master_budget_balance -= requested

    # Credit campaign escrow
    c.budget_escrow = requested
    c.status = "active"
    c.approved_by = current_user.id
    c.approved_at = datetime.now(timezone.utc)
    c.rejection_reason = None

    # Audit ledger
    balance_after = float(tenant.master_budget_balance)
    db.add(MasterBudgetLedger(
        tenant_id=tenant.id,
        transaction_type="debit",
        source="campaign_escrow",
        points=requested,
        currency="PTS",
        balance_after=balance_after,
        reference_type="sales_campaign",
        reference_id=c.id,
        description=f"Escrow for campaign: {c.title}",
        created_by=current_user.id,
    ))

    db.commit()
    db.refresh(c)
    return _campaign_response(c)


@router.post("/{campaign_id}/reject")
async def reject_campaign(
    campaign_id: UUID,
    payload: EscrowApprovalRequest,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    """Explicit reject endpoint (same logic as approve with approved=False)."""
    payload.approved = False
    return await approve_campaign(campaign_id, payload, current_user, db)


# ─── Participants ─────────────────────────────────────────────────────────────

@router.post("/{campaign_id}/participants")
async def add_participants(
    campaign_id: UUID,
    payload: ParticipantAddRequest,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    c = _get_campaign_or_404(db, campaign_id, current_user.tenant_id)
    added = []
    for uid in payload.user_ids:
        existing = db.query(CampaignParticipant).filter(
            CampaignParticipant.campaign_id == c.id,
            CampaignParticipant.user_id == uid,
        ).first()
        if not existing:
            db.add(CampaignParticipant(
                campaign_id=c.id,
                user_id=uid,
                tenant_id=c.tenant_id,
                role=payload.role,
            ))
            added.append(str(uid))
    db.commit()
    return {"added": added}


@router.delete("/{campaign_id}/participants/{user_id}")
async def remove_participant(
    campaign_id: UUID,
    user_id: UUID,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    c = _get_campaign_or_404(db, campaign_id, current_user.tenant_id)
    db.query(CampaignParticipant).filter(
        CampaignParticipant.campaign_id == c.id,
        CampaignParticipant.user_id == user_id,
    ).delete()
    db.commit()
    return {"removed": str(user_id)}


# ─── Lead Capture (Instant Payout Engine) ────────────────────────────────────

@router.post("/{campaign_id}/register-lead", status_code=201)
async def register_lead(
    campaign_id: UUID,
    payload: LeadCaptureRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Booth rep submits a visitor enquiry.

    Flow:
      1. Validate campaign is active & within date window
      2. Deduplicate visitor by hash
      3. Verify escrow has sufficient balance
      4. Atomically: deduct escrow, credit rep wallet, insert lead record
    """
    # ── 1. Validate campaign ──────────────────────────────────────────────
    c = _get_campaign_or_404(db, campaign_id, current_user.tenant_id)

    if c.status != "active":
        raise HTTPException(status_code=400, detail="Campaign is not active")

    now = datetime.now(timezone.utc)
    # Make start/end timezone-aware for comparison
    start = c.start_date if c.start_date.tzinfo else c.start_date.replace(tzinfo=timezone.utc)
    end = c.end_date if c.end_date.tzinfo else c.end_date.replace(tzinfo=timezone.utc)

    if now < start:
        raise HTTPException(status_code=400, detail="Campaign has not started yet")
    if now > end:
        raise HTTPException(status_code=400, detail="Campaign has ended")

    # ── 2. Deduplication ─────────────────────────────────────────────────
    visitor_hash = payload.contact_hash()
    duplicate = db.query(LeadRegistration).filter(
        LeadRegistration.campaign_id == campaign_id,
        LeadRegistration.visitor_hash == visitor_hash,
    ).first()
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="This visitor has already been registered for this campaign",
        )

    # ── 3. Daily cap per rep (optional) ──────────────────────────────────
    if c.max_leads_per_rep:
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = db.query(LeadRegistration).filter(
            LeadRegistration.campaign_id == campaign_id,
            LeadRegistration.sales_rep_id == current_user.id,
            LeadRegistration.created_at >= today_start,
            LeadRegistration.status == "verified",
        ).count()
        if today_count >= c.max_leads_per_rep:
            raise HTTPException(
                status_code=429,
                detail=f"Daily lead cap of {c.max_leads_per_rep} reached for today",
            )

    points = Decimal(str(c.points_per_lead))

    # ── 4. Atomic escrow deduction + wallet credit ───────────────────────
    # Lock campaign row
    c = db.query(SalesCampaign).filter(
        SalesCampaign.id == campaign_id
    ).with_for_update().first()

    if c.budget_escrow < points:
        raise HTTPException(
            status_code=400,
            detail="Campaign escrow is exhausted — no more leads can be rewarded",
        )

    # Deduct escrow
    c.budget_escrow -= points
    c.leads_rewarded = (c.leads_rewarded or 0) + 1
    c.points_disbursed = (c.points_disbursed or Decimal("0")) + points

    # Insert lead record
    lead = LeadRegistration(
        campaign_id=campaign_id,
        sales_rep_id=current_user.id,
        tenant_id=current_user.tenant_id,
        visitor_name=payload.visitor_name,
        visitor_email=payload.visitor_email,
        visitor_phone=payload.visitor_phone,
        visitor_hash=visitor_hash,
        interest_level=payload.interest_level,
        notes=payload.notes,
        status="verified",
        points_awarded=points,
    )
    db.add(lead)
    db.flush()

    # Credit the rep's wallet
    wallet, ledger = credit_user_wallet(
        db=db,
        user=current_user,
        points=points,
        source="campaign_lead",
        description=f"+{int(points)} pts — lead at '{c.title}'",
        reference_type="lead_registration",
        reference_id=lead.id,
    )

    db.commit()
    db.refresh(lead)

    return {
        "id": str(lead.id),
        "status": lead.status,
        "points_awarded": float(points),
        "wallet_balance": float(wallet.balance),
        "message": f"+{int(points)} Points Added to Wallet! 🎉",
        "visitor_name": lead.visitor_name,
        "created_at": lead.created_at.isoformat(),
    }


# ─── Lead listings ───────────────────────────────────────────────────────────

@router.get("/{campaign_id}/leads")
async def list_leads(
    campaign_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = _get_campaign_or_404(db, campaign_id, current_user.tenant_id)

    # Reps see only their own leads; managers see all
    query = db.query(LeadRegistration).filter(LeadRegistration.campaign_id == campaign_id)
    if current_user.org_role == "tenant_user":
        query = query.filter(LeadRegistration.sales_rep_id == current_user.id)

    leads = query.order_by(LeadRegistration.created_at.desc()).all()
    return [
        {
            "id": str(lr.id),
            "campaign_id": str(lr.campaign_id),
            "sales_rep_id": str(lr.sales_rep_id),
            "visitor_name": lr.visitor_name,
            "visitor_email": lr.visitor_email,
            "visitor_phone": lr.visitor_phone,
            "interest_level": lr.interest_level,
            "status": lr.status,
            "points_awarded": float(lr.points_awarded),
            "notes": lr.notes,
            "created_at": lr.created_at.isoformat(),
        }
        for lr in leads
    ]


@router.get("/{campaign_id}/leaderboard")
async def campaign_leaderboard(
    campaign_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Points leaderboard for a campaign — sorted by leads captured."""
    c = _get_campaign_or_404(db, campaign_id, current_user.tenant_id)

    rows = db.execute(
        text("""
            SELECT
                lr.sales_rep_id,
                u.first_name || ' ' || u.last_name  AS rep_name,
                u.avatar_url,
                COUNT(*)                             AS leads_count,
                SUM(lr.points_awarded)               AS total_points
            FROM lead_registrations lr
            JOIN users u ON u.id = lr.sales_rep_id
            WHERE lr.campaign_id = :cid
              AND lr.status = 'verified'
            GROUP BY lr.sales_rep_id, u.first_name, u.last_name, u.avatar_url
            ORDER BY leads_count DESC
        """),
        {"cid": str(campaign_id)},
    ).fetchall()

    return [
        {
            "sales_rep_id": str(r.sales_rep_id),
            "rep_name": r.rep_name,
            "avatar_url": r.avatar_url,
            "leads_count": r.leads_count,
            "total_points": float(r.total_points or 0),
        }
        for r in rows
    ]
