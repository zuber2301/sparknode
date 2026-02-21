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
    Department, Badge, Tenant
)
from auth.utils import get_current_user
from core.rbac import get_tenant_manager, get_platform_admin, get_dept_lead, RolePermissions
from analytics.schemas import (
    TenantAnalyticsResponse, EngagementMetrics, BudgetMetrics, RedemptionMetrics,
    DepartmentMetrics, LeaderboardEntry, CultureHeatmap, CultureHeatmapCell,
    RecognitionTrend, BadgeDistribution, AnalyticsQueryParams,
    PlatformMetricsResponse, TenantSummary, BenchmarkResponse, TenantBenchmark,
    ROIMetrics, InsightItem, InsightsResponse, SpendAnalysisResponse,
    BurnRatePoint, DepartmentSpend, AwardTier,
    DashboardSummaryResponse
)
from analytics.helpers import (
    get_period_dates,
    calculate_engagement_metrics,
    calculate_budget_metrics,
    calculate_redemption_metrics,
    calculate_department_metrics,
    get_leaderboard,
    calculate_daily_trends,
    calculate_culture_heatmap,
    calculate_badge_distribution,
    get_points_distributed_in_period
)

router = APIRouter()


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
    current_user: User = Depends(get_tenant_manager),
    db: Session = Depends(get_db)
):
    """Get comprehensive analytics for current tenant (Tenant Manager only)"""
    period_start, period_end = get_period_dates(period_type, start_date, end_date)
    tenant_id = current_user.tenant_id
    
    # Calculate all metrics using helper functions
    engagement = calculate_engagement_metrics(db, tenant_id, period_start, period_end)
    budget = calculate_budget_metrics(db, tenant_id, period_start, period_end)
    redemption = calculate_redemption_metrics(db, tenant_id, period_start, period_end)
    department_metrics = calculate_department_metrics(db, tenant_id, period_start, period_end)
    
    # Get leaderboards
    top_recognizers = get_leaderboard(db, tenant_id, period_start, period_end, 'givers')
    top_recipients = get_leaderboard(db, tenant_id, period_start, period_end, 'recipients')
    
    # Calculate trends if requested
    daily_trends = []
    if include_trends:
        daily_trends = calculate_daily_trends(db, tenant_id, period_start, period_end)
    
    # Calculate culture heatmap if requested
    culture_heatmap = None
    if include_heatmap:
        departments = db.query(Department).filter(Department.tenant_id == tenant_id).all()
        culture_heatmap = calculate_culture_heatmap(
            db, tenant_id, departments, period_start, period_end
        )
    
    # Get badge distribution
    badge_distribution = calculate_badge_distribution(db, tenant_id, period_start, period_end)
    
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
    current_user: User = Depends(get_tenant_manager),
    db: Session = Depends(get_db)
):
    """Get AI-generated insights and recommendations (Tenant Manager only)"""
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
    current_user: User = Depends(get_tenant_manager),
    db: Session = Depends(get_db)
):
    """Get benchmarking data comparing tenant to platform averages (Tenant Manager only)"""
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


@router.get("/spend-analysis", response_model=SpendAnalysisResponse)
async def get_spend_analysis(
    period_type: str = Query(default="monthly", regex="^(daily|weekly|monthly|quarterly|yearly)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_tenant_manager),
    db: Session = Depends(get_db)
):
    """Get detailed spend analysis for current tenant (Tenant Manager only)"""
    period_start, period_end = get_period_dates(period_type, start_date, end_date)
    tenant_id = current_user.tenant_id

    # 1. Burn Rate Velocity (Line Chart)
    # Group points by day
    daily_spend = db.query(
        func.date(Recognition.created_at).label('date'),
        func.sum(Recognition.points).label('points')
    ).filter(
        Recognition.tenant_id == tenant_id,
        Recognition.status == 'active',
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end
    ).group_by(func.date(Recognition.created_at)).order_by(func.date(Recognition.created_at)).all()

    burn_rate_velocity = [
        BurnRatePoint(date=str(row.date), points=Decimal(str(row.points)))
        for row in daily_spend
    ]

    # 2. Departmental Heatmap (Tree Map)
    dept_spend = db.query(
        Department.name,
        func.sum(Recognition.points).label('points')
    ).join(
        User, Recognition.from_user_id == User.id
    ).join(
        Department, User.department_id == Department.id
    ).filter(
        Recognition.tenant_id == tenant_id,
        Recognition.status == 'active',
        func.date(Recognition.created_at) >= period_start,
        func.date(Recognition.created_at) <= period_end
    ).group_by(Department.name).all()

    total_points_spent = sum(row.points for row in dept_spend) if dept_spend else Decimal("0")
    
    department_heatmap = [
        DepartmentSpend(
            department_name=row.name,
            points_spent=Decimal(str(row.points)),
            percentage=round(float(row.points / total_points_spent * 100), 2) if total_points_spent > 0 else 0
        )
        for row in dept_spend
    ]

    # 3. Award Tier Distribution (Bar Chart)
    # Tiers: Small (<100), Medium (100-500), Large (501-2000), Executive (>2000)
    tiers = [
        ("Small (<100)", 0, 99),
        ("Medium (100-500)", 100, 500),
        ("Large (501-2000)", 501, 2000),
        ("Executive (>2000)", 2001, 99999999)
    ]
    
    award_tier_distribution = []
    for (name, min_p, max_p) in tiers:
        res = db.query(
            func.count(Recognition.id).label('count'),
            func.sum(Recognition.points).label('points')
        ).filter(
            Recognition.tenant_id == tenant_id,
            Recognition.status == 'active',
            Recognition.points >= min_p,
            Recognition.points <= max_p,
            func.date(Recognition.created_at) >= period_start,
            func.date(Recognition.created_at) <= period_end
        ).first()
        
        award_tier_distribution.append(AwardTier(
            tier_name=name,
            count=res.count or 0,
            points=Decimal(str(res.points or 0))
        ))

    return SpendAnalysisResponse(
        burn_rate_velocity=burn_rate_velocity,
        department_heatmap=department_heatmap,
        award_tier_distribution=award_tier_distribution,
        total_spent=total_points_spent,
        period_start=period_start,
        period_end=period_end
    )

@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    current_user: User = Depends(get_tenant_manager),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.tenant_id
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    # 1. Stats
    master_pool = tenant.master_budget_balance
    total_delegated = db.query(func.sum(Department.budget_allocated)).filter(Department.tenant_id == tenant_id).scalar() or Decimal('0')
    total_in_wallets = db.query(func.sum(Wallet.balance)).filter(Wallet.tenant_id == tenant_id).scalar() or Decimal('0')
    active_users_count = db.query(User).filter(User.tenant_id == tenant_id, User.status == 'ACTIVE').count()
    
    stats = {
        "master_pool": master_pool,
        "total_delegated": total_delegated,
        "total_in_wallets": total_in_wallets,
        "active_users_count": active_users_count
    }
    
    # 2. Leads
    leads_query = db.query(User, Department, Wallet).join(
        Department, User.department_id == Department.id
    ).outerjoin(
        Wallet, User.id == Wallet.user_id
    ).filter(
        User.tenant_id == tenant_id,
        User.org_role == 'dept_lead'
    ).all()
    
    leads = [
        {
            "id": str(u.id),
            "name": f"{u.first_name} {u.last_name}",
            "email": u.corporate_email or u.email,
            "department": d.name,
            "balance": float(w.balance) if w else 0
        } for u, d, w in leads_query
    ]
    
    # 3. Recent Recognitions
    recent_recognitions_query = db.query(Recognition).filter(
        Recognition.tenant_id == tenant_id,
        Recognition.status == 'active'
    ).order_by(Recognition.created_at.desc()).limit(10).all()
    
    recent_recognitions = [
        {
            "id": str(r.id),
            "from_user": f"{r.from_user.first_name} {r.from_user.last_name}" if r.from_user else "System",
            "to_user": f"{r.to_user.first_name} {r.to_user.last_name}" if r.to_user else "Deleted User",
            "points": float(r.points),
            "message": r.message,
            "created_at": r.created_at.isoformat()
        } for r in recent_recognitions_query
    ]
    
    # 4. Spending Analytics stub
    spending_analytics = {
        "total_spent": float(db.query(func.sum(Recognition.points)).filter(Recognition.tenant_id == tenant_id).scalar() or 0)
    }
    
    return {
        "tenant_id": tenant_id,
        "tenant_name": tenant.name,
        "currency": tenant.display_currency or "INR",
        "stats": stats,
        "leads": leads,
        "recent_recognitions": recent_recognitions,
        "spending_analytics": spending_analytics
    }


# =====================================================
# DEPARTMENT LEAD DASHBOARD ENDPOINT
# =====================================================

@router.get("/dashboard/dept-summary")
async def get_dept_dashboard_summary(
    current_user: User = Depends(get_dept_lead),
    db: Session = Depends(get_db)
):
    """
    Department Lead Dashboard Summary.
    Returns metrics scoped strictly to the logged-in lead's own department:
    - Budget pool, consumed, in-wallets
    - Team member list with wallet balances and recognition stats
    - Top consumers (by points received)
    - Recent team recognitions
    """
    dept_id = current_user.department_id
    tenant_id = current_user.tenant_id

    # Department record
    dept = db.query(Department).filter(
        Department.id == dept_id,
        Department.tenant_id == tenant_id
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found for this user")

    # Tenant (for currency)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    currency = (tenant.display_currency if tenant else None) or "INR"

    # ── Budget metrics ───────────────────────────────
    budget_pool = float(dept.budget_balance or 0)       # available for lead to distribute
    budget_allocated = float(dept.budget_allocated or 0) # total received from master pool
    budget_consumed = max(0.0, budget_allocated - budget_pool)  # sent to member wallets
    utilization_pct = round(budget_consumed / budget_allocated * 100, 1) if budget_allocated > 0 else 0.0

    # ── Department members ───────────────────────────
    members_q = db.query(User).filter(
        User.department_id == dept_id,
        User.tenant_id == tenant_id,
        User.status == 'ACTIVE'
    ).all()
    member_ids = [m.id for m in members_q]
    total_members = len(members_q)

    # Member wallet balances
    wallet_rows = db.query(
        Wallet.user_id,
        Wallet.balance,
        Wallet.lifetime_earned,
        Wallet.lifetime_spent
    ).filter(
        Wallet.user_id.in_(member_ids),
        Wallet.tenant_id == tenant_id
    ).all()
    wallet_map = {
        str(r.user_id): {
            "balance": float(r.balance or 0),
            "lifetime_earned": float(r.lifetime_earned or 0),
            "lifetime_spent": float(r.lifetime_spent or 0),
        }
        for r in wallet_rows
    }
    total_in_wallets = sum(w["balance"] for w in wallet_map.values())

    # Recognitions received per member
    rec_received_q = db.query(
        Recognition.to_user_id,
        func.count(Recognition.id).label('cnt'),
        func.sum(Recognition.points).label('pts')
    ).filter(
        Recognition.to_user_id.in_(member_ids),
        Recognition.tenant_id == tenant_id,
        Recognition.status == 'active'
    ).group_by(Recognition.to_user_id).all()
    rec_received_map = {
        str(r.to_user_id): {"count": r.cnt, "points": float(r.pts or 0)}
        for r in rec_received_q
    }

    # Recognitions given per member
    rec_given_q = db.query(
        Recognition.from_user_id,
        func.count(Recognition.id).label('cnt')
    ).filter(
        Recognition.from_user_id.in_(member_ids),
        Recognition.tenant_id == tenant_id,
        Recognition.status == 'active'
    ).group_by(Recognition.from_user_id).all()
    rec_given_map = {str(r.from_user_id): r.cnt for r in rec_given_q}

    # Build full member list
    members_list = []
    for m in members_q:
        mid = str(m.id)
        w = wallet_map.get(mid, {"balance": 0, "lifetime_earned": 0, "lifetime_spent": 0})
        rr = rec_received_map.get(mid, {"count": 0, "points": 0})
        rg = rec_given_map.get(mid, 0)
        members_list.append({
            "id": mid,
            "name": f"{m.first_name} {m.last_name}",
            "email": m.corporate_email or "",
            "org_role": m.org_role,
            "wallet_balance": w["balance"],
            "lifetime_earned": w["lifetime_earned"],
            "lifetime_spent": w["lifetime_spent"],
            "recognitions_received": rr["count"],
            "points_received": rr["points"],
            "recognitions_given": rg,
        })

    # Top consumers by points received
    top_consumers = sorted(
        members_list, key=lambda x: x["points_received"], reverse=True
    )[:5]

    # ── Recent recognitions in this department ───────
    recent_recs_q = db.query(Recognition).filter(
        Recognition.tenant_id == tenant_id,
        Recognition.status == 'active',
        or_(
            Recognition.to_user_id.in_(member_ids),
            Recognition.from_user_id.in_(member_ids)
        )
    ).order_by(Recognition.created_at.desc()).limit(10).all()

    recent_recognitions = []
    for r in recent_recs_q:
        recent_recognitions.append({
            "id": str(r.id),
            "from_user": f"{r.from_user.first_name} {r.from_user.last_name}" if r.from_user else "System",
            "to_user": f"{r.to_user.first_name} {r.to_user.last_name}" if r.to_user else "Deleted User",
            "points": float(r.points),
            "message": r.message or "",
            "created_at": r.created_at.isoformat(),
        })

    return {
        "department": {
            "id": str(dept.id),
            "name": dept.name,
            "budget_pool": budget_pool,
            "budget_allocated": budget_allocated,
            "budget_consumed": budget_consumed,
            "utilization_pct": utilization_pct,
            "total_in_wallets": total_in_wallets,
        },
        "members": {
            "total": total_members,
            "list": members_list,
        },
        "top_consumers": top_consumers,
        "recent_recognitions": recent_recognitions,
        "currency": currency,
        "lead_name": f"{current_user.first_name} {current_user.last_name}",
    }
