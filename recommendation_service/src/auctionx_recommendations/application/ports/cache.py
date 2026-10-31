"""
Abstract port interface for caching recommendation slates and user cache versions.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional


class CachePort(ABC):
    """Port interface for distributed/in-memory caching."""

    @abstractmethod
    def get(self, key: str) -> Optional[str]:
        """Fetch a cached string value."""
        pass

    @abstractmethod
    def setex(self, key: str, ttl_seconds: int, value: str) -> bool:
        """Store a string value with bounded TTL."""
        pass

    @abstractmethod
    def delete(self, key: str) -> bool:
        """Evict a key from cache."""
        pass

    @abstractmethod
    def get_user_cache_version(self, email: str) -> str:
        """Retrieve the current invalidation version for a user."""
        pass

    @abstractmethod
    def increment_user_cache_version(self, email: str) -> int:
        """Atomically bump the user's cache version upon newly recorded interactions."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the cache backend is operational."""
        pass
