"""
Engagement Module Routes
------------------------
Handles EEE features:
  /api/engagement/values       — Company core values (tenant manager CRUD)
  /api/engagement/challenges   — Gamified challenges (tenant manager CRUD + user complete)
  /api/engagement/milestones   — Birthday/anniversary feed entries
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date, timedelta
from decimal import Decimal

from database import get_db
from models import (
    CompanyValue, EngagementChallenge, ChallengeCompletion,
    User, Wallet, WalletLedger, Feed, Tenant
)
from auth.utils import get_current_user, get_manager_or_above
from engagement.schemas import (
    CompanyValueCreate, CompanyValueUpdate, CompanyValueResponse,
    ChallengeCreate, ChallengeUpdate, ChallengeResponse, ChallengeWithStatus,
    MilestoneItem,
)

router = APIRouter()


# ─────────────────────── Company Values ──────────────────────────────────────

@router.get("/values", response_model=List[CompanyValueResponse])
async def list_company_values(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List active company values for the tenant."""
    return db.query(CompanyValue).filter(
        CompanyValue.tenant_id == current_user.tenant_id,
        CompanyValue.is_active == True
    ).order_by(CompanyValue.sort_order, CompanyValue.name).all()


@router.post("/values", response_model=CompanyValueResponse)
async def create_company_value(
    data: CompanyValueCreate,
    current_user: User = Depends(get_manager_or_above),
    db: Session = Depends(get_db)
):
    """Create a company value (tenant manager only)."""
    value = CompanyValue(
        tenant_id=current_user.tenant_id,
        name=data.name,
        emoji=data.emoji or "⭐",
        description=data.description,
        sort_order=data.sort_order or 0,
    )
    db.add(value)
    db.commit()
    db.refresh(value)
    return value


@router.put("/values/{value_id}", response_model=CompanyValueResponse)
async def update_company_value(
    value_id: UUID,
    data: CompanyValueUpdate,
    current_user: User = Depends(get_manager_or_above),
    db: Session = Depends(get_db)
):
    """Update a company value."""
    value = db.query(CompanyValue).filter(
        CompanyValue.id == value_id,
        CompanyValue.tenant_id == current_user.tenant_id
    ).first()
    if not value:
        raise HTTPException(status_code=404, detail="Company value not found")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(value, field, val)
    db.commit()
    db.refresh(value)
    return value


@router.delete("/values/{value_id}")
async def delete_company_value(
    value_id: UUID,
    current_user: User = Depends(get_manager_or_above),
    db: Session = Depends(get_db)
):
    """Soft-delete (deactivate) a company value."""
    value = db.query(CompanyValue).filter(
        CompanyValue.id == value_id,
        CompanyValue.tenant_id == current_user.tenant_id
    ).first()
    if not value:
        raise HTTPException(status_code=404, detail="Company value not found")
    value.is_active = False
    db.commit()
    return {"message": "Value deactivated"}


# ─────────────────────── Challenges ──────────────────────────────────────────

@router.get("/challenges", response_model=List[ChallengeWithStatus])
async def list_challenges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all active challenges with the current user's completion status."""
    challenges = db.query(EngagementChallenge).filter(
        EngagementChallenge.tenant_id == current_user.tenant_id,
        EngagementChallenge.is_active == True
    ).order_by(EngagementChallenge.created_at.desc()).all()

    completed_ids = {
        c.challenge_id for c in db.query(ChallengeCompletion).filter(
            ChallengeCompletion.user_id == current_user.id,
            ChallengeCompletion.tenant_id == current_user.tenant_id
        ).all()
    }

    result = []
    for ch in challenges:
        result.append(ChallengeWithStatus(
            id=ch.id,
            tenant_id=ch.tenant_id,
            title=ch.title,
            description=ch.description,
            challenge_type=ch.challenge_type,
            points_reward=ch.points_reward,
            badge_icon=ch.badge_icon,
            is_active=ch.is_active,
            deadline=ch.deadline,
            created_at=ch.created_at,
            completed=ch.id in completed_ids,
            completions_count=len(ch.completions),
        ))
    return result


@router.post("/challenges", response_model=ChallengeResponse)
async def create_challenge(
    data: ChallengeCreate,
    current_user: User = Depends(get_manager_or_above),
    db: Session = Depends(get_db)
):
    """Create a challenge (tenant manager only)."""
    challenge = EngagementChallenge(
        tenant_id=current_user.tenant_id,
        title=data.title,
        description=data.description,
        challenge_type=data.challenge_type or "manual",
        points_reward=data.points_reward or 100,
        badge_icon=data.badge_icon or "🎯",
        deadline=data.deadline,
        created_by=current_user.id,
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return challenge


@router.put("/challenges/{challenge_id}", response_model=ChallengeResponse)
async def update_challenge(
    challenge_id: UUID,
    data: ChallengeUpdate,
    current_user: User = Depends(get_manager_or_above),
    db: Session = Depends(get_db)
):
    """Update a challenge."""
    challenge = db.query(EngagementChallenge).filter(
        EngagementChallenge.id == challenge_id,
        EngagementChallenge.tenant_id == current_user.tenant_id
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(challenge, field, val)
    db.commit()
    db.refresh(challenge)
    return challenge


@router.post("/challenges/{challenge_id}/complete")
async def complete_challenge(
    challenge_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a challenge as completed by the current user and credit points."""
    challenge = db.query(EngagementChallenge).filter(
        EngagementChallenge.id == challenge_id,
        EngagementChallenge.tenant_id == current_user.tenant_id,
        EngagementChallenge.is_active == True
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found or inactive")

    already = db.query(ChallengeCompletion).filter(
        ChallengeCompletion.challenge_id == challenge_id,
        ChallengeCompletion.user_id == current_user.id
    ).first()
    if already:
        raise HTTPException(status_code=400, detail="Challenge already completed")

    points = float(challenge.points_reward)
    completion = ChallengeCompletion(
        tenant_id=current_user.tenant_id,
        challenge_id=challenge_id,
        user_id=current_user.id,
        points_awarded=points,
    )
    db.add(completion)

    # Credit wallet
    wallet = db.query(Wallet).filter(
        Wallet.user_id == current_user.id,
        Wallet.tenant_id == current_user.tenant_id
    ).first()
    if wallet:
        wallet.balance = float(wallet.balance) + points
        db.add(WalletLedger(
            wallet_id=wallet.id,
            tenant_id=current_user.tenant_id,
            transaction_type='credit',
            amount=points,
            description=f"Challenge completed: {challenge.title}",
            reference_type='challenge',
            reference_id=challenge_id
        ))

    # Post to feed
    db.add(Feed(
        tenant_id=current_user.tenant_id,
        event_type='challenge_completed',
        reference_type='challenge',
        reference_id=challenge_id,
        actor_id=current_user.id,
        target_id=current_user.id,
        visibility='public',
        event_metadata={
            "challenge_title": challenge.title,
            "badge_icon": challenge.badge_icon,
            "points": str(points),
        }
    ))

    db.commit()
    return {"message": "Challenge completed!", "points_awarded": points}


# ─────────────────────── Milestones ──────────────────────────────────────────

@router.get("/milestones/upcoming", response_model=List[MilestoneItem])
async def get_upcoming_milestones(
    days: int = Query(30, ge=1, le=90),
    current_user: User = Depends(get_manager_or_above),
    db: Session = Depends(get_db)
):
    """Get upcoming birthdays and work anniversaries within the next N days (manager view)."""
    today = date.today()
    window_end = today + timedelta(days=days)
    users = db.query(User).filter(
        User.tenant_id == current_user.tenant_id,
        User.status.in_(["ACTIVE", "active"])
    ).all()

    items: List[MilestoneItem] = []
    for u in users:
        # Birthday check
        if u.date_of_birth:
            try:
                bday = u.date_of_birth
                this_year_bday = bday.replace(year=today.year)
                if this_year_bday < today:
                    this_year_bday = bday.replace(year=today.year + 1)
                if today <= this_year_bday <= window_end:
                    items.append(MilestoneItem(
                        user_id=u.id,
                        user_name=f"{u.first_name} {u.last_name}",
                        milestone_type="birthday",
                        milestone_date=this_year_bday,
                        label=f"🎂 {u.first_name}'s Birthday",
                        years=None,
                    ))
            except Exception:
                pass

        # Work anniversary check
        if u.hire_date:
            try:
                hday = u.hire_date
                this_year_ann = hday.replace(year=today.year)
                if this_year_ann < today:
                    this_year_ann = hday.replace(year=today.year + 1)
                if today <= this_year_ann <= window_end:
                    years = today.year - hday.year
                    if this_year_ann.year > today.year:
                        years = (today.year + 1) - hday.year
                    if years > 0:
                        items.append(MilestoneItem(
                            user_id=u.id,
                            user_name=f"{u.first_name} {u.last_name}",
                            milestone_type="anniversary",
                            milestone_date=this_year_ann,
                            label=f"🎉 {u.first_name}'s {years}-Year Work Anniversary",
                            years=years,
                        ))
            except Exception:
                pass

    items.sort(key=lambda x: x.milestone_date)
    return items
