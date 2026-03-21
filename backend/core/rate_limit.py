"""
Simple Redis-backed rate limiter for OTP endpoints.

Usage:
    limiter = OtpRateLimiter()
    limiter.check(redis_client, key="otp:req:1.2.3.4", limit=3, window=60)

Raises HTTPException(429) when the limit is exceeded.
Uses a sliding-window counter implemented with INCR + EXPIRE.
"""
import os
import redis
from fastapi import HTTPException, status

_REDIS_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")

# Module-level connection pool — shared across all requests.
_pool = redis.ConnectionPool.from_url(_REDIS_URL, decode_responses=True, max_connections=20)


def get_redis() -> redis.Redis:
    return redis.Redis(connection_pool=_pool)


def check_rate_limit(key: str, limit: int, window: int) -> None:
    """Increment a Redis counter for `key`.  Raise 429 if count > limit.

    Args:
        key:    Unique string (e.g. "otp:req:<ip>")
        limit:  Max allowed hits within the window
        window: Window length in seconds
    """
    try:
        r = get_redis()
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, window)
        count, _ = pipe.execute()
        if count > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please wait before trying again.",
                headers={"Retry-After": str(window)},
            )
    except HTTPException:
        raise
    except Exception:
        # Redis unavailable — fail open so a Redis outage doesn't lock users out.
        pass
