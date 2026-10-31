"""
Redis cache adapter implementing the CachePort interface.
Provides resilient caching with bounded TTLs, atomic version increments, and non-blocking fallbacks.
"""

from typing import Optional
from ...application.ports.cache import CachePort


def build_redis_client(redis_url: str):
    """Construct a configured Redis client instance from a connection URL."""
    try:
        import redis
    except ImportError as err:
        raise RuntimeError("The 'redis' package is required for Redis cache support.") from err

    return redis.from_url(
        redis_url,
        decode_responses=True,
        socket_connect_timeout=5,
    )


class RedisCacheAdapter(CachePort):
    """Resilient Redis cache adapter implementing the application CachePort."""

    def __init__(self, raw_redis_client=None):
        self._client = raw_redis_client

    @property
    def raw_client(self):
        return self._client

    @raw_client.setter
    def raw_client(self, client):
        self._client = client

    def is_available(self) -> bool:
        if self._client is None:
            return False
        try:
            return bool(self._client.ping())
        except Exception:
            return False

    def get(self, key: str) -> Optional[str]:
        if not self._client:
            return None
        try:
            return self._client.get(key)
        except Exception:
            return None

    def setex(self, key: str, ttl_seconds: int, value: str) -> bool:
        if not self._client:
            return False
        try:
            self._client.setex(key, ttl_seconds, value)
            return True
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        if not self._client:
            return False
        try:
            self._client.delete(key)
            return True
        except Exception:
            return False

    def get_user_cache_version(self, email: str) -> str:
        if not self._client or not email:
            return "1"
        try:
            ver = self._client.get(f"user_rec_ver:{email.strip().lower()}")
            return str(ver) if ver else "1"
        except Exception:
            return "1"

    def increment_user_cache_version(self, email: str) -> int:
        if not self._client or not email:
            return 1
        try:
            ver_key = f"user_rec_ver:{email.strip().lower()}"
            val = self._client.incr(ver_key)
            self._client.expire(ver_key, 604800)  # 7-day TTL
            return int(val)
        except Exception:
            return 1
