"""
Analytics Schemas

Pydantic models for tenant-specific analytics and platform metrics.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal


# =====================================================
# ENGAGEMENT METRICS
# =====================================================

class EngagementMetrics(BaseModel):
    """Core engagement metrics for a time period."""
    active_users: int = 0
    total_users: int = 0
    participation_rate: float = 0.0  # percentage
    recognitions_given: int = 0
    recognitions_received: int = 0
    avg_recognitions_per_user: float = 0.0
    engagement_score: float = 0.0  # 0-100


class BudgetMetrics(BaseModel):
    """Budget utilization metrics."""
    total_budget: Decimal = Decimal("0")
    allocated_budget: Decimal = Decimal("0")
    spent_budget: Decimal = Decimal("0")
    remaining_budget: Decimal = Decimal("0")
    utilization_rate: float = 0.0  # percentage
    burn_rate: Decimal = Decimal("0")  # points per day
    projected_exhaustion_date: Optional[date] = None


class RedemptionMetrics(BaseModel):
    """Redemption activity metrics."""
    total_redemptions: int = 0
    total_points_redeemed: Decimal = Decimal("0")
    total_value_redeemed: Decimal = Decimal("0")
    avg_redemption_value: Decimal = Decimal("0")
    top_categories: List[Dict[str, Any]] = []
    top_brands: List[Dict[str, Any]] = []


class DepartmentMetrics(BaseModel):
    """Metrics broken down by department."""
    department_id: UUID
    department_name: str
    active_users: int = 0
    total_users: int = 0
    recognitions_given: int = 0
    recognitions_received: int = 0
    points_distributed: Decimal = Decimal("0")
    points_redeemed: Decimal = Decimal("0")
    engagement_score: float = 0.0
    budget_utilization: float = 0.0


class LeaderboardEntry(BaseModel):
    """Leaderboard entry for top performers."""
    rank: int
    user_id: UUID
    user_name: str
    department_name: Optional[str] = None
    avatar_url: Optional[str] = None
    count: int = 0  # recognitions given/received
    points: Decimal = Decimal("0")


class CultureHeatmapCell(BaseModel):
    """Single cell in the culture heatmap."""
    from_department: str
    to_department: str
    recognition_count: int = 0
    points_total: Decimal = Decimal("0")
    intensity: float = 0.0  # 0-1 normalized value


class CultureHeatmap(BaseModel):
    """Cross-department recognition heatmap."""
    departments: List[str]
    matrix: List[List[CultureHeatmapCell]]
    
    class Config:
        from_attributes = True


class RecognitionTrend(BaseModel):
    """Recognition trend over time."""
    date: date
    recognitions_count: int = 0
    points_distributed: Decimal = Decimal("0")
    active_users: int = 0


class BadgeDistribution(BaseModel):
    """Badge usage distribution."""
    badge_id: UUID
    badge_name: str
    badge_icon: Optional[str] = None
    count: int = 0
    percentage: float = 0.0


# =====================================================
# TENANT ANALYTICS RESPONSE
# =====================================================

class TenantAnalyticsResponse(BaseModel):
    """Complete tenant analytics response."""
    tenant_id: UUID
    period_type: str  # daily, weekly, monthly, quarterly, yearly
    period_start: date
    period_end: date
    
    # Core metrics
    engagement: EngagementMetrics
    budget: BudgetMetrics
    redemption: RedemptionMetrics
    
    # Breakdowns
    department_metrics: List[DepartmentMetrics] = []
    
    # Leaderboards
    top_recognizers: List[LeaderboardEntry] = []
    top_recipients: List[LeaderboardEntry] = []
    
    # Trends
    daily_trends: List[RecognitionTrend] = []
    
    # Culture insights
    culture_heatmap: Optional[CultureHeatmap] = None
    badge_distribution: List[BadgeDistribution] = []
    
    # Metadata
    computed_at: datetime


class AnalyticsQueryParams(BaseModel):
    """Query parameters for analytics requests."""
    period_type: str = Field(default="monthly", pattern="^(daily|weekly|monthly|quarterly|yearly)$")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    department_id: Optional[UUID] = None
    include_heatmap: bool = True
    include_trends: bool = True


# =====================================================
# PLATFORM METRICS (Platform Admin only)
# =====================================================

class TenantSummary(BaseModel):
    """Summary of a single tenant for platform view."""
    tenant_id: UUID
    tenant_name: str
    status: str
    subscription_tier: str
    user_count: int
    active_user_count: int
    engagement_score: float
    monthly_recognitions: int
    created_at: datetime


class PlatformMetricsResponse(BaseModel):
    """Platform-wide metrics for Platform Admin."""
    period_type: str
    period_start: date
    period_end: date
    
    # Tenant metrics
    total_tenants: int = 0
    active_tenants: int = 0
    new_tenants: int = 0
    churned_tenants: int = 0
    
    # User metrics
    total_users: int = 0
    active_users: int = 0
    new_users: int = 0
    
    # Transaction metrics
    total_recognitions: int = 0
    total_points_distributed: Decimal = Decimal("0")
    total_redemptions: int = 0
    total_redemption_value: Decimal = Decimal("0")
    
    # Revenue (if applicable)
    mrr: Decimal = Decimal("0")
    arr: Decimal = Decimal("0")
    
    # Tier breakdown
    tier_breakdown: Dict[str, int] = {}
    
    # Growth trends
    tenant_growth_trend: List[Dict[str, Any]] = []
    user_growth_trend: List[Dict[str, Any]] = []
    
    # Top tenants (for benchmarking)
    top_tenants_by_engagement: List[TenantSummary] = []
    
    computed_at: datetime


class TenantBenchmark(BaseModel):
    """Benchmark data for comparing tenants."""
    metric_name: str
    tenant_value: float
    platform_average: float
    platform_median: float
    percentile: float  # Where tenant stands (0-100)
    trend: str  # up, down, stable


class BenchmarkResponse(BaseModel):
    """Tenant benchmarking against platform."""
    tenant_id: UUID
    period_type: str
    period_start: date
    period_end: date
    benchmarks: List[TenantBenchmark]
    computed_at: datetime


# =====================================================
# ROI & INSIGHTS
# =====================================================

class ROIMetrics(BaseModel):
    """Return on Investment metrics."""
    total_investment: Decimal = Decimal("0")  # Budget allocated
    points_distributed: Decimal = Decimal("0")
    monetary_value_distributed: Decimal = Decimal("0")
    engagement_lift: float = 0.0  # percentage increase
    participation_lift: float = 0.0
    estimated_productivity_impact: Decimal = Decimal("0")
    cost_per_recognition: Decimal = Decimal("0")
    cost_per_active_user: Decimal = Decimal("0")


class InsightItem(BaseModel):
    """AI-generated insight or recommendation."""
    category: str  # engagement, budget, recognition, redemption
    type: str  # positive, negative, neutral, action
    title: str
    description: str
    metric_value: Optional[float] = None
    metric_change: Optional[float] = None  # percentage change
    recommended_action: Optional[str] = None


class InsightsResponse(BaseModel):
    """Collection of insights and recommendations."""
    tenant_id: UUID
    period_type: str
    insights: List[InsightItem]
    roi_metrics: ROIMetrics
    generated_at: datetime
