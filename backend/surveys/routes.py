"""
Pulse Surveys — Routes
======================
Deliverable: Weekly pulse surveys → engagement score dashboard.

Endpoints:
  POST /api/surveys/create-pulse         — Admin: create a pulse survey
  GET  /api/surveys/                     — Admin: list all surveys
  GET  /api/surveys/my-pending           — Employee: pending surveys not yet responded to
  POST /api/surveys/{survey_id}/respond  — Employee: submit anonymous response
  GET  /api/surveys/results              — Admin: anonymized results (latest or by id)
  GET  /api/surveys/engagement-trends   — Admin: weekly score trend data for dashboard
"""

from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_

from auth.utils import get_current_user
from database import get_db
from models import (
    User, PulseSurvey, PulseSurveyQuestion,
    PulseSurveyResponse, SurveyStatus,
)
from config import settings

router = APIRouter()

# ─── role guards ──────────────────────────────────────────────────────────────

ADMIN_ROLES = {"tenant_manager", "hr_admin", "platform_admin"}


def _require_admin(user: User) -> None:
    if user.org_role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")


# ─── internals ───────────────────────────────────────────────────────────────

def _respondent_hash(user: User, survey_id) -> str:
    """
    HMAC-SHA256 of (user_id, survey_id).  Allows duplicate detection without
    storing the user_id — the hash cannot be reversed without the secret key.
    """
    secret = (getattr(settings, "secret_key", None) or "sparknode-secret-key").encode()
    msg = f"{user.id}:{survey_id}".encode()
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def _nps_score(scores: list) -> Optional[int]:
    """Classic NPS = %Promoters(9-10) − %Detractors(0-6), range −100…100."""
    if not scores:
        return None
    total = len(scores)
    promoters = sum(1 for s in scores if s >= 9)
    detractors = sum(1 for s in scores if s <= 6)
    return round((promoters / total - detractors / total) * 100)


def _serialize_survey(survey: PulseSurvey) -> dict:
    return {
        "id": str(survey.id),
        "title": survey.title,
        "target_department": survey.target_department,
        "status": survey.status.value if hasattr(survey.status, "value") else survey.status,
        "nps_enabled": survey.nps_enabled,
        "closes_at": survey.closes_at.isoformat() if survey.closes_at else None,
        "created_at": survey.created_at.isoformat() if survey.created_at else None,
        "question_count": len(survey.questions),
        "response_count": len(survey.responses),
    }


# ─── endpoints ───────────────────────────────────────────────────────────────

@router.post("/create-pulse", status_code=201)
def create_pulse_survey(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin: create a weekly pulse survey.

    Request body (all optional):
      title              str      — defaults to "Weekly Engagement Pulse"
      target_department  str|null — None = company-wide
      nps_enabled        bool     — adds a 0–10 NPS question
      closes_in_days     int      — days until auto-close (default 7)
      extra_questions    list[str]— up to 5 additional free-text questions
    """
    _require_admin(current_user)

    title = str(body.get("title") or "Weekly Engagement Pulse").strip()
    dept = body.get("target_department") or None
    nps = bool(body.get("nps_enabled", False))
    closes_in = max(1, int(body.get("closes_in_days") or 7))
    extra_qs = [str(q) for q in (body.get("extra_questions") or []) if q][:5]

    now = datetime.now(timezone.utc)
    survey = PulseSurvey(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        title=title,
        target_department=dept,
        status=SurveyStatus.ACTIVE,
        nps_enabled=nps,
        closes_at=now + timedelta(days=closes_in),
    )
    db.add(survey)
    db.flush()  # generate survey.id

    questions = [
        PulseSurveyQuestion(
            survey_id=survey.id,
            text="How engaged are you this week?",
            question_type="rating_5",
            sort_order=0,
        )
    ]
    if nps:
        questions.append(
            PulseSurveyQuestion(
                survey_id=survey.id,
                text="How likely are you to recommend this company as a great place to work? (0–10)",
                question_type="rating_10",
                sort_order=1,
            )
        )
    for i, q_text in enumerate(extra_qs):
        questions.append(
            PulseSurveyQuestion(
                survey_id=survey.id,
                text=q_text[:500],
                question_type="text",
                sort_order=10 + i,
            )
        )

    for q in questions:
        db.add(q)
    db.commit()
    db.refresh(survey)

    return {
        "survey_id": str(survey.id),
        "title": survey.title,
        "target_department": survey.target_department,
        "status": "active",
        "closes_at": survey.closes_at.isoformat(),
        "questions": [
            {"id": str(q.id), "text": q.text, "type": q.question_type}
            for q in survey.questions
        ],
    }


@router.get("/")
def list_surveys(
    status: Optional[str] = Query(None, description="draft|active|closed"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: list all pulse surveys for this tenant."""
    _require_admin(current_user)
    q = db.query(PulseSurvey).filter(PulseSurvey.tenant_id == current_user.tenant_id)
    if status:
        q = q.filter(PulseSurvey.status == status)
    surveys = q.order_by(desc(PulseSurvey.created_at)).all()
    return [_serialize_survey(s) for s in surveys]


@router.get("/my-pending")
def my_pending_surveys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Employee: list active surveys this user has not yet responded to."""
    now = datetime.now(timezone.utc)
    active = (
        db.query(PulseSurvey)
        .filter(
            PulseSurvey.tenant_id == current_user.tenant_id,
            PulseSurvey.status == SurveyStatus.ACTIVE,
        )
        .all()
    )

    # Filter to surveys scoped to this employee's department (or company-wide)
    user_dept = getattr(current_user, "department", None)
    pending = []
    for survey in active:
        if survey.target_department and survey.target_department != user_dept:
            continue
        rh = _respondent_hash(current_user, survey.id)
        already = (
            db.query(PulseSurveyResponse)
            .filter(
                PulseSurveyResponse.survey_id == survey.id,
                PulseSurveyResponse.respondent_hash == rh,
            )
            .first()
        )
        if not already:
            pending.append(
                {
                    "id": str(survey.id),
                    "title": survey.title,
                    "closes_at": survey.closes_at.isoformat() if survey.closes_at else None,
                    "questions": [
                        {"id": str(q.id), "text": q.text, "type": q.question_type}
                        for q in survey.questions
                    ],
                }
            )
    return pending


@router.post("/{survey_id}/respond", status_code=201)
def respond_to_survey(
    survey_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Employee: submit an anonymous response to a pulse survey.

    Body: { answers: [{question_id, score?}, {question_id, comment?}] }
    score: int 1-5 (rating_5) or 0-10 (rating_10)
    comment: str (text question)
    """
    survey = (
        db.query(PulseSurvey)
        .filter(
            PulseSurvey.id == survey_id,
            PulseSurvey.tenant_id == current_user.tenant_id,
            PulseSurvey.status == SurveyStatus.ACTIVE,
        )
        .first()
    )
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found or not active")

    rh = _respondent_hash(current_user, survey.id)
    if (
        db.query(PulseSurveyResponse)
        .filter(
            PulseSurveyResponse.survey_id == survey.id,
            PulseSurveyResponse.respondent_hash == rh,
        )
        .first()
    ):
        raise HTTPException(status_code=409, detail="Already responded to this survey")

    answers = body.get("answers") or []
    if not answers:
        raise HTTPException(status_code=422, detail="At least one answer is required")

    valid_qids = {str(q.id) for q in survey.questions}
    user_dept = getattr(current_user, "department", None)
    stored = 0

    for ans in answers:
        qid = str(ans.get("question_id", ""))
        if qid not in valid_qids:
            continue
        score = ans.get("score")
        comment = ans.get("comment")
        if score is None and not comment:
            continue
        db.add(
            PulseSurveyResponse(
                survey_id=survey.id,
                question_id=UUID(qid),
                tenant_id=current_user.tenant_id,
                respondent_hash=rh,
                department=user_dept,
                score=int(score) if score is not None else None,
                comment=str(comment)[:1000] if comment else None,
            )
        )
        stored += 1

    db.commit()
    return {"ok": True, "answers_stored": stored}


@router.get("/results")
def survey_results(
    survey_id: Optional[str] = Query(None, description="Survey UUID; omit for latest"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin: anonymized aggregated results for a pulse survey.
    Returns engagement_score (1-5), nps_score (-100…100 if NPS enabled),
    per-department breakdown, low-engagement departments, and recent comments.
    """
    _require_admin(current_user)

    if survey_id:
        survey = (
            db.query(PulseSurvey)
            .filter(
                PulseSurvey.id == survey_id,
                PulseSurvey.tenant_id == current_user.tenant_id,
            )
            .first()
        )
    else:
        survey = (
            db.query(PulseSurvey)
            .filter(PulseSurvey.tenant_id == current_user.tenant_id)
            .order_by(desc(PulseSurvey.created_at))
            .first()
        )

    if not survey:
        return {"total_responses": 0, "message": "No surveys found"}

    # Unique respondent count (anonymized)
    unique_resp = (
        db.query(func.count(func.distinct(PulseSurveyResponse.respondent_hash)))
        .filter(PulseSurveyResponse.survey_id == survey.id)
        .scalar()
    ) or 0

    # Engagement score (rating_5 questions)
    eng_qids = [q.id for q in survey.questions if q.question_type == "rating_5"]
    eng_scores = []
    if eng_qids:
        rows = (
            db.query(PulseSurveyResponse.score)
            .filter(
                PulseSurveyResponse.survey_id == survey.id,
                PulseSurveyResponse.question_id.in_(eng_qids),
                PulseSurveyResponse.score.isnot(None),
            )
            .all()
        )
        eng_scores = [r.score for r in rows]
    avg_eng = round(sum(eng_scores) / len(eng_scores), 2) if eng_scores else None

    # NPS (rating_10 questions)
    nps_qids = [q.id for q in survey.questions if q.question_type == "rating_10"]
    nps = None
    if nps_qids:
        nps_rows = (
            db.query(PulseSurveyResponse.score)
            .filter(
                PulseSurveyResponse.survey_id == survey.id,
                PulseSurveyResponse.question_id.in_(nps_qids),
                PulseSurveyResponse.score.isnot(None),
            )
            .all()
        )
        nps = _nps_score([r.score for r in nps_rows])

    # Department breakdown (only rating_5 scores for engagement grouping)
    dept_q = db.query(
        PulseSurveyResponse.department,
        func.avg(PulseSurveyResponse.score).label("avg_score"),
        func.count(func.distinct(PulseSurveyResponse.respondent_hash)).label("respondents"),
    ).filter(
        PulseSurveyResponse.survey_id == survey.id,
        PulseSurveyResponse.score.isnot(None),
    )
    if eng_qids:
        dept_q = dept_q.filter(PulseSurveyResponse.question_id.in_(eng_qids))
    dept_rows = dept_q.group_by(PulseSurveyResponse.department).all()

    by_department = [
        {
            "department": r.department or "Unknown",
            "engagement_score": round(float(r.avg_score), 2) if r.avg_score else None,
            "respondents": r.respondents,
        }
        for r in dept_rows
    ]
    low_engagement = [
        d for d in by_department
        if d["engagement_score"] is not None and d["engagement_score"] < 3.0
    ]

    # Recent anonymous comments (max 20, newest first)
    comment_rows = (
        db.query(PulseSurveyResponse.comment)
        .filter(
            PulseSurveyResponse.survey_id == survey.id,
            PulseSurveyResponse.comment.isnot(None),
            PulseSurveyResponse.comment != "",
        )
        .order_by(desc(PulseSurveyResponse.submitted_at))
        .limit(20)
        .all()
    )
    comments = [r.comment for r in comment_rows if r.comment]

    return {
        "survey_id": str(survey.id),
        "title": survey.title,
        "target_department": survey.target_department,
        "status": survey.status.value if hasattr(survey.status, "value") else survey.status,
        "created_at": survey.created_at.isoformat() if survey.created_at else None,
        "closes_at": survey.closes_at.isoformat() if survey.closes_at else None,
        "total_responses": unique_resp,
        "engagement_score": avg_eng,
        "nps_score": nps,
        "by_department": by_department,
        "low_engagement_departments": low_engagement,
        "recent_comments": comments,
    }


@router.get("/engagement-trends")
def engagement_trends(
    weeks: int = Query(12, ge=1, le=52, description="Past surveys to include"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin: weekly engagement score trend data for the dashboard chart.
    Returns one data point per survey (ordered by created_at).
    """
    _require_admin(current_user)

    surveys = (
        db.query(PulseSurvey)
        .filter(
            PulseSurvey.tenant_id == current_user.tenant_id,
            PulseSurvey.status.in_([SurveyStatus.ACTIVE, SurveyStatus.CLOSED]),
        )
        .order_by(PulseSurvey.created_at)
        .limit(weeks)
        .all()
    )

    data = []
    for survey in surveys:
        eng_qids = [q.id for q in survey.questions if q.question_type == "rating_5"]
        if not eng_qids:
            continue
        rows = (
            db.query(PulseSurveyResponse.score)
            .filter(
                PulseSurveyResponse.survey_id == survey.id,
                PulseSurveyResponse.question_id.in_(eng_qids),
                PulseSurveyResponse.score.isnot(None),
            )
            .all()
        )
        scores = [r.score for r in rows]
        avg = round(sum(scores) / len(scores), 2) if scores else None
        data.append(
            {
                "survey_id": str(survey.id),
                "title": survey.title,
                "week": survey.created_at.strftime("%b %d") if survey.created_at else None,
                "engagement_score": avg,
                "response_count": len(scores),
            }
        )

    direction = "stable"
    if len(data) >= 2:
        last = data[-1]["engagement_score"]
        prev = data[-2]["engagement_score"]
        if last is not None and prev is not None:
            if last > prev + 0.2:
                direction = "improving"
            elif last < prev - 0.2:
                direction = "declining"

    return {
        "weeks": weeks,
        "surveys_count": len(data),
        "direction": direction,
        "data": data,
    }
