"""
Analytics Helper Functions

This module contains helper functions for calculating various analytics metrics.
These functions are extracted from the main routes to improve code organization,
testability, and reusability.
"""

from typing import List, Optional, Tuple, Set
from uuid import UUID
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from models import (
    User, Recognition, Wallet, WalletLedger, Redemption, Budget, DepartmentBudget,
    Department, Badge
)
from analytics.schemas import (
    EngagementMetrics, BudgetMetrics, RedemptionMetrics, DepartmentMetrics,
    LeaderboardEntry, CultureHeatmap, CultureHeatmapCell, RecognitionTrend,
    BadgeDistribution
)


def get_period_dates(
    period_type: str, 
    start_date: Optional[date] = None, 
    end_date: Optional[date] = None
) -> Tuple[date, date]:
    """
    Calculate period start and end dates based on period type.
    
    Args:
        period_type: One of 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
        start_date: Optional explicit start date
        end_date: Optional explicit end date
        
    Returns:
        Tuple of (start_date, end_date)
    """
    today = date.today()
    
    if start_date and end_date:
        return start_date, end_date
    
    if period_type == "daily":
        return today, today
    elif period_type == "weekly":
        start = today - timedelta(days=today.weekday())
        return start, today
    elif period_type == "monthly":
        start = today.replace(day=1)
        return start, today
    elif period_type == "quarterly":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        start = today.replace(month=quarter_month, day=1)
        return start, today
    elif period_type == "yearly":
        start = today.replace(month=1, day=1)
        return start, today
    else:
        return today - timedelta(days=30), today


def calculate_engagement_metrics(
    db: Session,
    tenant_id: UUID,
    period_start: date,
    period_end: date
) -> EngagementMetrics:
    """
    Calculate engagement metrics for a tenant within a period.
    
    Returns:
        EngagementMetrics with participation rates, recognition counts, etc.
    """
    # Get total users
    total_users = db.query(User).filter(
        User.tenant_id == tenant_id,
        func.lower(User.status) == 'active'
    ).count()
    
    # Get active users (who gave or received recognition in period)
    active_user_ids = db.query(Recognition.from_user_id).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end
    ).union(
        db.query(Recognition.to_user_id).filter(
            Recognition.tenant_id == tenant_id,
            func.date(Recognition.created_at) >= period_start,
            func.date(Recognition.created_at) <= period_end
        )
    ).distinct().all()
    active_users = len(active_user_ids)
    
    # Get recognition counts
    recognitions = db.query(Recognition).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end,
        Recognition.status == 'active'
    ).all()
    
    recognitions_count = len(recognitions)
    
    # Calculate metrics
    participation_rate = (active_users / total_users * 100) if total_users > 0 else 0
    avg_recognitions = recognitions_count / active_users if active_users > 0 else 0
    engagement_score = min(100, (participation_rate * 0.4) + (avg_recognitions * 10 * 0.6))
    
    return EngagementMetrics(
        active_users=active_users,
        total_users=total_users,
        participation_rate=round(participation_rate, 2),
        recognitions_given=recognitions_count,
        recognitions_received=recognitions_count,
        avg_recognitions_per_user=round(avg_recognitions, 2),
        engagement_score=round(engagement_score, 2)
    )


def calculate_budget_metrics(
    db: Session,
    tenant_id: UUID,
    period_start: date,
    period_end: date
) -> BudgetMetrics:
    """
    Calculate budget metrics including burn rate and projections.
    
    Returns:
        BudgetMetrics with utilization, burn rate, and exhaustion projections
    """
    active_budget = db.query(Budget).filter(
        Budget.tenant_id == tenant_id,
        Budget.status == 'active'
    ).first()
    
    if not active_budget:
        return BudgetMetrics()
    
    total_budget = Decimal(str(active_budget.total_points))
    allocated = Decimal(str(active_budget.allocated_points))
    
    # Calculate spent from department budgets
    dept_budgets = db.query(DepartmentBudget).filter(
        DepartmentBudget.budget_id == active_budget.id
    ).all()
    spent = sum(Decimal(str(db.spent_points)) for db in dept_budgets)
    
    days_elapsed = (period_end - period_start).days or 1
    burn_rate = spent / days_elapsed if days_elapsed > 0 else Decimal("0")
    
    remaining = allocated - spent
    utilization = (spent / allocated * 100) if allocated > 0 else 0
    
    # Project exhaustion date
    exhaustion_date = None
    if burn_rate > 0 and remaining > 0:
        days_remaining = int(remaining / burn_rate)
        exhaustion_date = date.today() + timedelta(days=days_remaining)
    
    return BudgetMetrics(
        total_budget=total_budget,
        allocated_budget=allocated,
        spent_budget=spent,
        remaining_budget=remaining,
        utilization_rate=round(float(utilization), 2),
        burn_rate=round(burn_rate, 2),
        projected_exhaustion_date=exhaustion_date
    )


def calculate_redemption_metrics(
    db: Session,
    tenant_id: UUID,
    period_start: date,
    period_end: date
) -> RedemptionMetrics:
    """
    Calculate redemption metrics for a period.
    
    Returns:
        RedemptionMetrics with counts and averages
    """
    redemptions = db.query(Redemption).filter(
        Redemption.tenant_id == tenant_id,
        func.date(Redemption.created_at) >= period_start,
        func.date(Redemption.created_at) <= period_end
    ).all()
    
    total_points_redeemed = sum(Decimal(str(r.points_used)) for r in redemptions)
    
    return RedemptionMetrics(
        total_redemptions=len(redemptions),
        total_points_redeemed=total_points_redeemed,
        avg_redemption_value=total_points_redeemed / len(redemptions) if redemptions else Decimal("0")
    )


def calculate_department_metrics(
    db: Session,
    tenant_id: UUID,
    period_start: date,
    period_end: date
) -> List[DepartmentMetrics]:
    """
    Calculate metrics for each department in the tenant.
    
    Returns:
        List of DepartmentMetrics for each department
    """
    departments = db.query(Department).filter(
        Department.tenant_id == tenant_id
    ).all()
    
    department_metrics = []
    for dept in departments:
        metrics = _calculate_single_department_metrics(
            db, dept, tenant_id, period_start, period_end
        )
        department_metrics.append(metrics)
    
    return department_metrics


def _calculate_single_department_metrics(
    db: Session,
    dept: Department,
    tenant_id: UUID,
    period_start: date,
    period_end: date
) -> DepartmentMetrics:
    """Calculate metrics for a single department."""
    dept_users = db.query(User).filter(
        User.department_id == dept.id,
        func.lower(User.status) == 'active'
    ).all()
    dept_user_ids = [u.id for u in dept_users]
    
    dept_recognitions = db.query(Recognition).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end,
        or_(
            Recognition.from_user_id.in_(dept_user_ids),
            Recognition.to_user_id.in_(dept_user_ids)
        )
    ).all()
    
    given = len([r for r in dept_recognitions if r.from_user_id in dept_user_ids])
    received = len([r for r in dept_recognitions if r.to_user_id in dept_user_ids])
    
    dept_active = len(set(
        [r.from_user_id for r in dept_recognitions if r.from_user_id in dept_user_ids] +
        [r.to_user_id for r in dept_recognitions if r.to_user_id in dept_user_ids]
    ))
    
    dept_engagement = 0
    if len(dept_users) > 0:
        dept_participation = dept_active / len(dept_users) * 100
        dept_avg = (given + received) / dept_active if dept_active > 0 else 0
        dept_engagement = min(100, (dept_participation * 0.4) + (dept_avg * 10 * 0.6))
    
    return DepartmentMetrics(
        department_id=dept.id,
        department_name=dept.name,
        active_users=dept_active,
        total_users=len(dept_users),
        recognitions_given=given,
        recognitions_received=received,
        points_distributed=sum(r.points for r in dept_recognitions if r.from_user_id in dept_user_ids),
        engagement_score=round(dept_engagement, 2)
    )


def get_leaderboard(
    db: Session,
    tenant_id: UUID,
    period_start: date,
    period_end: date,
    leaderboard_type: str = 'givers',
    limit: int = 10
) -> List[LeaderboardEntry]:
    """
    Get leaderboard of top recognizers or recipients.
    
    Args:
        leaderboard_type: 'givers' or 'recipients'
        limit: Maximum entries to return
        
    Returns:
        List of LeaderboardEntry
    """
    if leaderboard_type == 'givers':
        user_column = Recognition.from_user_id
    else:
        user_column = Recognition.to_user_id
    
    query_results = db.query(
        user_column,
        func.count(Recognition.id).label('count'),
        func.sum(Recognition.points).label('points')
    ).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end,
        Recognition.status == 'active'
    ).group_by(user_column).order_by(func.count(Recognition.id).desc()).limit(limit).all()
    
    entries = []
    for i, (user_id, count, points) in enumerate(query_results, 1):
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            dept = db.query(Department).filter(Department.id == user.department_id).first()
            entries.append(LeaderboardEntry(
                rank=i,
                user_id=user_id,
                user_name=f"{user.first_name} {user.last_name}",
                department_name=dept.name if dept else None,
                avatar_url=user.avatar_url,
                count=count,
                points=points or Decimal("0")
            ))
    
    return entries


def calculate_daily_trends(
    db: Session,
    tenant_id: UUID,
    period_start: date,
    period_end: date
) -> List[RecognitionTrend]:
    """
    Calculate daily recognition trends for a period.
    
    Returns:
        List of RecognitionTrend for each day
    """
    daily_trends = []
    current_date = period_start
    
    while current_date <= period_end:
        day_recognitions = db.query(Recognition).filter(
            Recognition.tenant_id == tenant_id,
            func.date(Recognition.created_at) == current_date,
            Recognition.status == 'active'
        ).all()
        
        day_active = len(set(
            [r.from_user_id for r in day_recognitions] +
            [r.to_user_id for r in day_recognitions]
        ))
        
        daily_trends.append(RecognitionTrend(
            date=current_date,
            recognitions_count=len(day_recognitions),
            points_distributed=sum(r.points for r in day_recognitions),
            active_users=day_active
        ))
        current_date += timedelta(days=1)
    
    return daily_trends


def calculate_culture_heatmap(
    db: Session,
    tenant_id: UUID,
    departments: List[Department],
    period_start: date,
    period_end: date
) -> Optional[CultureHeatmap]:
    """
    Calculate cross-department recognition heatmap.
    
    Returns:
        CultureHeatmap showing recognition flows between departments,
        or None if less than 2 departments
    """
    if len(departments) < 2:
        return None
    
    dept_names = [d.name for d in departments]
    matrix = []
    
    # Pre-fetch user IDs for each department
    dept_user_map = {}
    for dept in departments:
        users = db.query(User).filter(User.department_id == dept.id).all()
        dept_user_map[dept.id] = [u.id for u in users]
    
    for from_dept in departments:
        row = []
        from_user_ids = dept_user_map[from_dept.id]
        
        for to_dept in departments:
            to_user_ids = dept_user_map[to_dept.id]
            
            cross_recognitions = db.query(Recognition).filter(
                Recognition.tenant_id == tenant_id,
                func.date(Recognition.created_at) >= period_start,
                func.date(Recognition.created_at) <= period_end,
                Recognition.from_user_id.in_(from_user_ids),
                Recognition.to_user_id.in_(to_user_ids),
                Recognition.status == 'active'
            ).all()
            
            count = len(cross_recognitions)
            points = sum(r.points for r in cross_recognitions)
            
            row.append(CultureHeatmapCell(
                from_department=from_dept.name,
                to_department=to_dept.name,
                recognition_count=count,
                points_total=points,
                intensity=min(1.0, count / 10) if count > 0 else 0
            ))
        matrix.append(row)
    
    return CultureHeatmap(
        departments=dept_names,
        matrix=matrix
    )


def calculate_badge_distribution(
    db: Session,
    tenant_id: UUID,
    period_start: date,
    period_end: date
) -> List[BadgeDistribution]:
    """
    Calculate badge usage distribution for a period.
    
    Returns:
        List of BadgeDistribution showing badge popularity
    """
    badge_counts = db.query(
        Recognition.badge_id,
        func.count(Recognition.id).label('count')
    ).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end,
        Recognition.badge_id.isnot(None),
        Recognition.status == 'active'
    ).group_by(Recognition.badge_id).all()
    
    total_with_badges = sum(c for _, c in badge_counts)
    badge_distribution = []
    
    for badge_id, count in badge_counts:
        badge = db.query(Badge).filter(Badge.id == badge_id).first()
        if badge:
            badge_distribution.append(BadgeDistribution(
                badge_id=badge_id,
                badge_name=badge.name,
                badge_icon=badge.icon_url,
                count=count,
                percentage=round(count / total_with_badges * 100, 2) if total_with_badges > 0 else 0
            ))
    
    return badge_distribution


def get_points_distributed_in_period(
    db: Session,
    tenant_id: UUID,
    period_start: date,
    period_end: date
) -> int:
    """Get total points distributed in the period."""
    recognitions = db.query(Recognition).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end,
        Recognition.status == 'active'
    ).all()
    
    return sum(r.points for r in recognitions)
