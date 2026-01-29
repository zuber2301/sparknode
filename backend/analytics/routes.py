"""
Analytics Routes

Tenant-specific analytics with:
- Siloed ROI metrics
- Engagement scores and participation rates
- Culture heatmaps
- Budget burn rates
    - Platform-wide benchmarking (Platform Admin only)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import Optional
from uuid import UUID
from datetime import date, datetime, timedelta
from decimal import Decimal

from database import get_db
from models import (
    User, Recognition, Wallet, WalletLedger, Redemption, Budget, DepartmentBudget,
    Department, Badge, Tenant, TenantAnalytics, PlatformMetrics
)
from auth.utils import get_current_user
from core.rbac import get_tenant_admin, get_platform_admin, RolePermissions
from analytics.schemas import (
    TenantAnalyticsResponse, EngagementMetrics, BudgetMetrics, RedemptionMetrics,
    DepartmentMetrics, LeaderboardEntry, CultureHeatmap, CultureHeatmapCell,
    RecognitionTrend, BadgeDistribution, AnalyticsQueryParams,
    PlatformMetricsResponse, TenantSummary, BenchmarkResponse, TenantBenchmark,
    ROIMetrics, InsightItem, InsightsResponse
)

router = APIRouter()


def get_period_dates(period_type: str, start_date: Optional[date] = None, end_date: Optional[date] = None):
    """Calculate period start and end dates based on period type."""
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


# =====================================================
# TENANT ANALYTICS ENDPOINTS
# =====================================================

@router.get("/dashboard", response_model=TenantAnalyticsResponse)
async def get_tenant_analytics(
    period_type: str = Query(default="monthly", regex="^(daily|weekly|monthly|quarterly|yearly)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_heatmap: bool = True,
    include_trends: bool = True,
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db)
):
    """Get comprehensive analytics for current tenant (Tenant Admin only)"""
    period_start, period_end = get_period_dates(period_type, start_date, end_date)
    tenant_id = current_user.tenant_id
    
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
    points_distributed = sum(r.points for r in recognitions)
    
    # Engagement metrics
    participation_rate = (active_users / total_users * 100) if total_users > 0 else 0
    avg_recognitions = recognitions_count / active_users if active_users > 0 else 0
    engagement_score = min(100, (participation_rate * 0.4) + (avg_recognitions * 10 * 0.6))
    
    engagement = EngagementMetrics(
        active_users=active_users,
        total_users=total_users,
        participation_rate=round(participation_rate, 2),
        recognitions_given=recognitions_count,
        recognitions_received=recognitions_count,  # Same count, different perspective
        avg_recognitions_per_user=round(avg_recognitions, 2),
        engagement_score=round(engagement_score, 2)
    )
    
    # Budget metrics
    active_budget = db.query(Budget).filter(
        Budget.tenant_id == tenant_id,
        Budget.status == 'active'
    ).first()
    
    budget = BudgetMetrics()
    if active_budget:
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
        
        budget = BudgetMetrics(
            total_budget=total_budget,
            allocated_budget=allocated,
            spent_budget=spent,
            remaining_budget=remaining,
            utilization_rate=round(float(utilization), 2),
            burn_rate=round(burn_rate, 2),
            projected_exhaustion_date=exhaustion_date
        )
    
    # Redemption metrics
    redemptions = db.query(Redemption).filter(
        Redemption.tenant_id == tenant_id,
        func.date(Redemption.created_at) >= period_start,
        func.date(Redemption.created_at) <= period_end
    ).all()
    
    total_points_redeemed = sum(Decimal(str(r.points_used)) for r in redemptions)
    
    redemption = RedemptionMetrics(
        total_redemptions=len(redemptions),
        total_points_redeemed=total_points_redeemed,
        avg_redemption_value=total_points_redeemed / len(redemptions) if redemptions else Decimal("0")
    )
    
    # Department metrics
    departments = db.query(Department).filter(
        Department.tenant_id == tenant_id
    ).all()
    
    department_metrics = []
    for dept in departments:
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
        
        department_metrics.append(DepartmentMetrics(
            department_id=dept.id,
            department_name=dept.name,
            active_users=dept_active,
            total_users=len(dept_users),
            recognitions_given=given,
            recognitions_received=received,
            points_distributed=sum(r.points for r in dept_recognitions if r.from_user_id in dept_user_ids),
            engagement_score=round(dept_engagement, 2)
        ))
    
    # Top recognizers leaderboard
    top_recognizers_query = db.query(
        Recognition.from_user_id,
        func.count(Recognition.id).label('count'),
        func.sum(Recognition.points).label('points')
    ).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end,
        Recognition.status == 'active'
    ).group_by(Recognition.from_user_id).order_by(func.count(Recognition.id).desc()).limit(10).all()
    
    top_recognizers = []
    for i, (user_id, count, points) in enumerate(top_recognizers_query, 1):
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            dept = db.query(Department).filter(Department.id == user.department_id).first()
            top_recognizers.append(LeaderboardEntry(
                rank=i,
                user_id=user_id,
                user_name=f"{user.first_name} {user.last_name}",
                department_name=dept.name if dept else None,
                avatar_url=user.avatar_url,
                count=count,
                points=points or Decimal("0")
            ))
    
    # Top recipients leaderboard
    top_recipients_query = db.query(
        Recognition.to_user_id,
        func.count(Recognition.id).label('count'),
        func.sum(Recognition.points).label('points')
    ).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end,
        Recognition.status == 'active'
    ).group_by(Recognition.to_user_id).order_by(func.count(Recognition.id).desc()).limit(10).all()
    
    top_recipients = []
    for i, (user_id, count, points) in enumerate(top_recipients_query, 1):
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            dept = db.query(Department).filter(Department.id == user.department_id).first()
            top_recipients.append(LeaderboardEntry(
                rank=i,
                user_id=user_id,
                user_name=f"{user.first_name} {user.last_name}",
                department_name=dept.name if dept else None,
                avatar_url=user.avatar_url,
                count=count,
                points=points or Decimal("0")
            ))
    
    # Daily trends
    daily_trends = []
    if include_trends:
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
    
    # Culture heatmap
    culture_heatmap = None
    if include_heatmap and len(departments) > 1:
        dept_names = [d.name for d in departments]
        matrix = []
        
        for from_dept in departments:
            row = []
            from_user_ids = [u.id for u in db.query(User).filter(User.department_id == from_dept.id).all()]
            
            for to_dept in departments:
                to_user_ids = [u.id for u in db.query(User).filter(User.department_id == to_dept.id).all()]
                
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
        
        culture_heatmap = CultureHeatmap(
            departments=dept_names,
            matrix=matrix
        )
    
    # Badge distribution
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
    
    return TenantAnalyticsResponse(
        tenant_id=tenant_id,
        period_type=period_type,
        period_start=period_start,
        period_end=period_end,
        engagement=engagement,
        budget=budget,
        redemption=redemption,
        department_metrics=department_metrics,
        top_recognizers=top_recognizers,
        top_recipients=top_recipients,
        daily_trends=daily_trends,
        culture_heatmap=culture_heatmap,
        badge_distribution=badge_distribution,
        computed_at=datetime.utcnow()
    )


@router.get("/insights", response_model=InsightsResponse)
async def get_insights(
    period_type: str = Query(default="monthly"),
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db)
):
    """Get AI-generated insights and recommendations"""
    period_start, period_end = get_period_dates(period_type)
    tenant_id = current_user.tenant_id
    
    insights = []
    
    # Get current metrics
    total_users = db.query(User).filter(
        User.tenant_id == tenant_id,
        func.lower(User.status) == 'active'
    ).count()
    
    recognitions = db.query(Recognition).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end,
        Recognition.status == 'active'
    ).count()
    
    active_recognizers = db.query(func.count(func.distinct(Recognition.from_user_id))).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end
    ).scalar() or 0
    
    participation_rate = (active_recognizers / total_users * 100) if total_users > 0 else 0
    
    # Generate insights based on metrics
    if participation_rate < 30:
        insights.append(InsightItem(
            category="engagement",
            type="action",
            title="Low Participation Rate",
            description=f"Only {participation_rate:.1f}% of employees have given recognition this period.",
            metric_value=participation_rate,
            recommended_action="Consider launching a recognition challenge or sending reminders to managers."
        ))
    elif participation_rate > 70:
        insights.append(InsightItem(
            category="engagement",
            type="positive",
            title="Excellent Participation!",
            description=f"{participation_rate:.1f}% of employees are actively recognizing their peers.",
            metric_value=participation_rate
        ))
    
    # Check budget utilization
    active_budget = db.query(Budget).filter(
        Budget.tenant_id == tenant_id,
        Budget.status == 'active'
    ).first()
    
    if active_budget:
        utilization = float(active_budget.allocated_points) / float(active_budget.total_points) * 100 if active_budget.total_points else 0
        
        if utilization < 50 and period_type == "monthly":
            insights.append(InsightItem(
                category="budget",
                type="action",
                title="Budget Underutilization",
                description=f"Only {utilization:.1f}% of budget has been allocated.",
                metric_value=utilization,
                recommended_action="Review department allocations and ensure managers have sufficient budget."
            ))
    
    # ROI Metrics
    total_points_distributed = db.query(func.sum(Recognition.points)).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end
    ).scalar() or 0
    
    roi_metrics = ROIMetrics(
        total_investment=active_budget.total_points if active_budget else Decimal("0"),
        points_distributed=Decimal(str(total_points_distributed)),
        cost_per_recognition=Decimal(str(total_points_distributed)) / recognitions if recognitions > 0 else Decimal("0"),
        cost_per_active_user=Decimal(str(total_points_distributed)) / active_recognizers if active_recognizers > 0 else Decimal("0")
    )
    
    return InsightsResponse(
        tenant_id=tenant_id,
        period_type=period_type,
        insights=insights,
        roi_metrics=roi_metrics,
        generated_at=datetime.utcnow()
    )


# =====================================================
# PLATFORM ANALYTICS (Platform Admin only)
# =====================================================

@router.get("/platform", response_model=PlatformMetricsResponse)
async def get_platform_metrics(
    period_type: str = Query(default="monthly"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Get platform-wide metrics (Platform Admin only)"""
    period_start, period_end = get_period_dates(period_type, start_date, end_date)

    if tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        total_tenants = 1
        active_tenants = 1 if tenant.status == 'active' and tenant.subscription_status == 'active' else 0
        new_tenants = 1 if period_start <= tenant.created_at.date() <= period_end else 0

        total_users = db.query(User).filter(
            func.lower(User.status) == 'active',
            User.tenant_id == tenant_id
        ).count()

        total_recognitions = db.query(Recognition).filter(
            Recognition.tenant_id == tenant_id,
            func.date(Recognition.created_at) >= period_start,
            func.date(Recognition.created_at) <= period_end,
            Recognition.status == 'active'
        ).count()

        total_points = db.query(func.sum(Recognition.points)).filter(
            Recognition.tenant_id == tenant_id,
            func.date(Recognition.created_at) >= period_start,
            func.date(Recognition.created_at) <= period_end,
            Recognition.status == 'active'
        ).scalar() or 0

        total_redemptions = db.query(Redemption).filter(
            Redemption.tenant_id == tenant_id,
            func.date(Redemption.created_at) >= period_start,
            func.date(Redemption.created_at) <= period_end
        ).count()

        tier_breakdown = {tenant.subscription_tier or 'free': 1}

        active_users = db.query(func.count(func.distinct(Recognition.from_user_id))).filter(
            Recognition.tenant_id == tenant_id,
            func.date(Recognition.created_at) >= period_start,
            func.date(Recognition.created_at) <= period_end
        ).scalar() or 0

        engagement = (active_users / total_users * 100) if total_users > 0 else 0

        tenant_summaries = [TenantSummary(
            tenant_id=tenant.id,
            tenant_name=tenant.name,
            status=tenant.status,
            subscription_tier=tenant.subscription_tier or 'free',
            user_count=total_users,
            active_user_count=active_users,
            engagement_score=round(engagement, 2),
            monthly_recognitions=total_recognitions,
            created_at=tenant.created_at
        )]

        return PlatformMetricsResponse(
            period_type=period_type,
            period_start=period_start,
            period_end=period_end,
            total_tenants=total_tenants,
            active_tenants=active_tenants,
            new_tenants=new_tenants,
            churned_tenants=0,
            total_users=total_users,
            active_users=0,
            new_users=0,
            total_recognitions=total_recognitions,
            total_points_distributed=Decimal(str(total_points)),
            total_redemptions=total_redemptions,
            total_redemption_value=Decimal("0"),
            tier_breakdown=tier_breakdown,
            top_tenants_by_engagement=tenant_summaries,
            computed_at=datetime.utcnow()
        )
    
    # Tenant metrics
    total_tenants = db.query(Tenant).count()
    active_tenants = db.query(Tenant).filter(
        Tenant.status == 'active',
        Tenant.subscription_status == 'active'
    ).count()
    
    new_tenants = db.query(Tenant).filter(
        func.date(Tenant.created_at) >= period_start,
        func.date(Tenant.created_at) <= period_end
    ).count()
    
    # User metrics
    total_users = db.query(User).filter(func.lower(User.status) == 'active').count()
    
    # Transaction metrics
    total_recognitions = db.query(Recognition).filter(
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end,
        Recognition.status == 'active'
    ).count()
    
    total_points = db.query(func.sum(Recognition.points)).filter(
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end,
        Recognition.status == 'active'
    ).scalar() or 0
    
    total_redemptions = db.query(Redemption).filter(
        func.date(Redemption.created_at) >= period_start,
        func.date(Redemption.created_at) <= period_end
    ).count()
    
    # Tier breakdown
    tier_counts = db.query(
        Tenant.subscription_tier,
        func.count(Tenant.id)
    ).group_by(Tenant.subscription_tier).all()
    tier_breakdown = {tier: count for tier, count in tier_counts}
    
    # Top tenants by engagement
    tenants = db.query(Tenant).filter(Tenant.status == 'active').all()
    tenant_summaries = []
    for tenant in tenants:
        user_count = db.query(User).filter(
            User.tenant_id == tenant.id,
            func.lower(User.status) == 'active'
        ).count()
        
        monthly_recognitions = db.query(Recognition).filter(
            Recognition.tenant_id == tenant.id,
            func.date(Recognition.created_at) >= period_start,
            func.date(Recognition.created_at) <= period_end
        ).count()
        
        active_users = db.query(func.count(func.distinct(Recognition.from_user_id))).filter(
            Recognition.tenant_id == tenant.id,
            func.date(Recognition.created_at) >= period_start,
            func.date(Recognition.created_at) <= period_end
        ).scalar() or 0
        
        engagement = (active_users / user_count * 100) if user_count > 0 else 0
        
        tenant_summaries.append(TenantSummary(
            tenant_id=tenant.id,
            tenant_name=tenant.name,
            status=tenant.status,
            subscription_tier=tenant.subscription_tier or 'free',
            user_count=user_count,
            active_user_count=active_users,
            engagement_score=round(engagement, 2),
            monthly_recognitions=monthly_recognitions,
            created_at=tenant.created_at
        ))
    
    # Sort by engagement
    tenant_summaries.sort(key=lambda x: x.engagement_score, reverse=True)
    
    return PlatformMetricsResponse(
        period_type=period_type,
        period_start=period_start,
        period_end=period_end,
        total_tenants=total_tenants,
        active_tenants=active_tenants,
        new_tenants=new_tenants,
        churned_tenants=0,  # Would need historical tracking
        total_users=total_users,
        active_users=0,  # Would need to compute
        new_users=0,  # Would need historical tracking
        total_recognitions=total_recognitions,
        total_points_distributed=Decimal(str(total_points)),
        total_redemptions=total_redemptions,
        total_redemption_value=Decimal("0"),  # Would need to compute
        tier_breakdown=tier_breakdown,
        top_tenants_by_engagement=tenant_summaries[:10],
        computed_at=datetime.utcnow()
    )


@router.get("/benchmark", response_model=BenchmarkResponse)
async def get_tenant_benchmark(
    period_type: str = Query(default="monthly"),
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db)
):
    """Get benchmarking data comparing tenant to platform averages"""
    period_start, period_end = get_period_dates(period_type)
    tenant_id = current_user.tenant_id
    
    benchmarks = []
    
    # Calculate tenant metrics
    tenant_users = db.query(User).filter(
        User.tenant_id == tenant_id,
        func.lower(User.status) == 'active'
    ).count()
    
    tenant_recognitions = db.query(Recognition).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end,
        Recognition.status == 'active'
    ).count()
    
    tenant_active = db.query(func.count(func.distinct(Recognition.from_user_id))).filter(
        Recognition.tenant_id == tenant_id,
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end
    ).scalar() or 0
    
    tenant_participation = (tenant_active / tenant_users * 100) if tenant_users > 0 else 0
    tenant_recognitions_per_user = tenant_recognitions / tenant_users if tenant_users > 0 else 0
    
    # Calculate platform averages
    all_tenants = db.query(Tenant).filter(Tenant.status == 'active').all()
    platform_participations = []
    platform_recognitions_per_user = []
    
    for tenant in all_tenants:
        t_users = db.query(User).filter(
            User.tenant_id == tenant.id,
            func.lower(User.status) == 'active'
        ).count()
        
        if t_users > 0:
            t_active = db.query(func.count(func.distinct(Recognition.from_user_id))).filter(
                Recognition.tenant_id == tenant.id,
                func.date(Recognition.created_at) >= period_start,
                func.date(Recognition.created_at) <= period_end
            ).scalar() or 0
            
            t_recognitions = db.query(Recognition).filter(
                Recognition.tenant_id == tenant.id,
                func.date(Recognition.created_at) >= period_start,
                func.date(Recognition.created_at) <= period_end
            ).count()
            
            platform_participations.append(t_active / t_users * 100)
            platform_recognitions_per_user.append(t_recognitions / t_users)
    
    # Calculate averages and percentiles
    if platform_participations:
        avg_participation = sum(platform_participations) / len(platform_participations)
        sorted_participations = sorted(platform_participations)
        median_participation = sorted_participations[len(sorted_participations) // 2]
        
        # Calculate percentile
        below_count = sum(1 for p in platform_participations if p < tenant_participation)
        percentile = (below_count / len(platform_participations)) * 100
        
        benchmarks.append(TenantBenchmark(
            metric_name="Participation Rate",
            tenant_value=round(tenant_participation, 2),
            platform_average=round(avg_participation, 2),
            platform_median=round(median_participation, 2),
            percentile=round(percentile, 1),
            trend="stable"
        ))
    
    if platform_recognitions_per_user:
        avg_rpu = sum(platform_recognitions_per_user) / len(platform_recognitions_per_user)
        sorted_rpu = sorted(platform_recognitions_per_user)
        median_rpu = sorted_rpu[len(sorted_rpu) // 2]
        
        below_count = sum(1 for r in platform_recognitions_per_user if r < tenant_recognitions_per_user)
        percentile = (below_count / len(platform_recognitions_per_user)) * 100
        
        benchmarks.append(TenantBenchmark(
            metric_name="Recognitions Per User",
            tenant_value=round(tenant_recognitions_per_user, 2),
            platform_average=round(avg_rpu, 2),
            platform_median=round(median_rpu, 2),
            percentile=round(percentile, 1),
            trend="stable"
        ))
    
    return BenchmarkResponse(
        tenant_id=tenant_id,
        period_type=period_type,
        period_start=period_start,
        period_end=period_end,
        benchmarks=benchmarks,
        computed_at=datetime.utcnow()
    )
