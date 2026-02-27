"""
Tenant Rate Limiting & Subscription Enforcement Middleware

Provides two critical SaaS capabilities:
1. Per-tenant API rate limiting to prevent abuse / noisy-neighbor problems
2. Subscription tier enforcement (user limits, feature gates, tenant status checks)
"""

import time
import logging
from collections import defaultdict
from typing import Dict, Tuple, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# 1. Per-Tenant Rate Limiter (in-memory, suitable for single-node deploy)
# ──────────────────────────────────────────────────────────────────────────────

# Rate limits per subscription tier (requests per minute)
TIER_RATE_LIMITS: Dict[str, int] = {
    "free": 60,
    "starter": 300,
    "professional": 1000,
    "enterprise": 5000,
}

# In-memory sliding-window counters per tenant
# Structure: { tenant_id: [(timestamp, count)] }
_rate_buckets: Dict[str, list] = defaultdict(list)
_WINDOW_SECONDS = 60


def _check_rate_limit(tenant_id: str, tier: str) -> Tuple[bool, int, int]:
    """
    Check if a tenant has exceeded their rate limit.
    Returns (allowed, remaining, limit).
    """
    limit = TIER_RATE_LIMITS.get(tier, TIER_RATE_LIMITS["starter"])
    now = time.time()
    bucket = _rate_buckets[tenant_id]

    # Prune entries older than the window
    bucket[:] = [(ts, c) for ts, c in bucket if now - ts < _WINDOW_SECONDS]

    total_requests = sum(c for _, c in bucket)

    if total_requests >= limit:
        return False, 0, limit

    # Add this request
    if bucket and now - bucket[-1][0] < 1.0:
        # Merge into the last 1-second bucket
        bucket[-1] = (bucket[-1][0], bucket[-1][1] + 1)
    else:
        bucket.append((now, 1))

    return True, limit - total_requests - 1, limit


class TenantRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Per-tenant rate limiting middleware.
    Reads tenant_id and subscription_tier from the request state
    (set by the auth dependency or TenantMiddleware).
    
    Skips rate limiting for:
    - Health check endpoints
    - Login/signup/public endpoints
    - Platform admin requests
    """

    # Paths that are exempt from rate limiting
    EXEMPT_PATHS = {"/health", "/", "/api/auth/login", "/api/auth/signup", "/docs", "/openapi.json"}

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip exempt paths
        if path in self.EXEMPT_PATHS or path.startswith("/tenant/"):
            return await call_next(request)

        # Extract tenant context from the request after auth runs
        # We inject rate-limit headers regardless, but only enforce for tenant requests
        response = await call_next(request)

        # Try to read tenant context that was set during auth
        try:
            from core.tenant import get_tenant_context
            context = get_tenant_context()
            if context and not context.global_access:
                tenant_id = str(context.tenant_id)
                # Look up tenant tier from the context or default to 'starter'
                tier = getattr(request.state, "subscription_tier", "starter") if hasattr(request, "state") else "starter"
                
                allowed, remaining, limit = _check_rate_limit(tenant_id, tier)
                
                response.headers["X-RateLimit-Limit"] = str(limit)
                response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))

                if not allowed:
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Rate limit exceeded. Please try again later."},
                        headers={
                            "X-RateLimit-Limit": str(limit),
                            "X-RateLimit-Remaining": "0",
                            "Retry-After": str(_WINDOW_SECONDS),
                        },
                    )
        except Exception:
            # Never let rate limiting crash a request
            pass

        return response


# ──────────────────────────────────────────────────────────────────────────────
# 2. Subscription Enforcement Middleware
# ──────────────────────────────────────────────────────────────────────────────

# Feature gates per subscription tier
TIER_FEATURES: Dict[str, set] = {
    "free": {
        "recognition",
        "feed",
        "wallet",
        "basic_analytics",
    },
    "starter": {
        "recognition",
        "feed",
        "wallet",
        "basic_analytics",
        "departments",
        "budgets",
        "redemption",
        "notifications",
        "audit",
    },
    "professional": {
        "recognition",
        "feed",
        "wallet",
        "basic_analytics",
        "departments",
        "budgets",
        "redemption",
        "notifications",
        "audit",
        "events",
        "advanced_analytics",
        "bulk_operations",
        "custom_badges",
        "catalog_customization",
    },
    "enterprise": {
        "recognition",
        "feed",
        "wallet",
        "basic_analytics",
        "departments",
        "budgets",
        "redemption",
        "notifications",
        "audit",
        "events",
        "advanced_analytics",
        "bulk_operations",
        "custom_badges",
        "catalog_customization",
        "sales_events",
        "crm_connectors",
        "copilot",
        "sso",
        "api_export",
        "custom_branding",
        "white_label",
    },
}

# Map API path prefixes to feature names
PATH_FEATURE_MAP: Dict[str, str] = {
    "/api/events": "events",
    "/api/sales-events": "sales_events",
    "/api/crm": "crm_connectors",
    "/api/copilot": "copilot",
    "/api/snpilot": "copilot",
    "/api/analytics/engagement": "advanced_analytics",
    "/api/analytics/trends": "advanced_analytics",
    "/api/analytics/export": "api_export",
    "/api/catalog/tenant/custom": "catalog_customization",
    "/api/users/bulk": "bulk_operations",
    "/api/users/upload": "bulk_operations",
}

# User limits per subscription tier
TIER_USER_LIMITS: Dict[str, int] = {
    "free": 25,
    "starter": 50,
    "professional": 500,
    "enterprise": 10000,
}


class SubscriptionEnforcementMiddleware(BaseHTTPMiddleware):
    """
    Enforces subscription tier limits:
    1. Feature gating — blocks API calls to features not in the tenant's plan
    2. User count limits — blocks user creation when at capacity
    3. Tenant status — blocks all API calls for suspended/inactive tenants
    
    Skips enforcement for:
    - Public endpoints (login, signup, health)
    - Platform admin requests (they manage all tenants)
    """

    EXEMPT_PATHS = {"/health", "/", "/api/auth/login", "/api/auth/signup", "/docs", "/openapi.json"}

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip exempt paths
        if path in self.EXEMPT_PATHS or path.startswith("/tenant/") or path.startswith("/api/auth/") or path.startswith("/api/platform"):
            return await call_next(request)

        response = await call_next(request)

        # Check after auth has run
        try:
            from core.tenant import get_tenant_context
            context = get_tenant_context()
            
            if context is None or context.global_access:
                return response

            # Lazy-load tenant details for enforcement
            from database import SessionLocal
            from models import Tenant
            db = SessionLocal()
            try:
                tenant = db.query(Tenant).filter(Tenant.id == context.tenant_id).first()
                if tenant is None:
                    return response

                # 1. Tenant status check — block suspended/inactive tenants
                if tenant.status in ("suspended", "inactive"):
                    return JSONResponse(
                        status_code=403,
                        content={
                            "detail": f"Tenant account is {tenant.status}. Please contact support.",
                            "error_code": "TENANT_SUSPENDED",
                        },
                    )

                # 2. Subscription status check
                if tenant.subscription_status in ("cancelled", "past_due"):
                    # Allow read-only for past_due, block everything for cancelled
                    if tenant.subscription_status == "cancelled" and request.method not in ("GET", "HEAD", "OPTIONS"):
                        return JSONResponse(
                            status_code=402,
                            content={
                                "detail": "Subscription cancelled. Please renew to continue.",
                                "error_code": "SUBSCRIPTION_CANCELLED",
                            },
                        )

                # 3. Feature gating
                tier = (tenant.subscription_tier or "starter").lower()
                allowed_features = TIER_FEATURES.get(tier, TIER_FEATURES["starter"])
                
                for prefix, feature in PATH_FEATURE_MAP.items():
                    if path.startswith(prefix) and feature not in allowed_features:
                        return JSONResponse(
                            status_code=403,
                            content={
                                "detail": f"Feature '{feature}' is not available on the '{tier}' plan. Please upgrade.",
                                "error_code": "FEATURE_NOT_AVAILABLE",
                                "required_tier": _get_minimum_tier(feature),
                            },
                        )

                # 4. User creation limit check
                if path == "/api/users" and request.method == "POST":
                    from models import User
                    user_count = db.query(User).filter(
                        User.tenant_id == context.tenant_id,
                        User.status == "ACTIVE",
                    ).count()
                    user_limit = tenant.max_users or TIER_USER_LIMITS.get(tier, 50)
                    if user_count >= user_limit:
                        return JSONResponse(
                            status_code=403,
                            content={
                                "detail": f"User limit reached ({user_count}/{user_limit}). Please upgrade your plan.",
                                "error_code": "USER_LIMIT_REACHED",
                                "current_count": user_count,
                                "limit": user_limit,
                            },
                        )
            finally:
                db.close()

        except Exception:
            # Never let enforcement middleware crash a request
            logger.warning("Subscription enforcement check failed", exc_info=True)

        return response


def _get_minimum_tier(feature: str) -> str:
    """Find the lowest tier that includes a given feature."""
    for tier in ("free", "starter", "professional", "enterprise"):
        if feature in TIER_FEATURES.get(tier, set()):
            return tier
    return "enterprise"
