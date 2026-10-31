"""
Infrastructure layer for AuctionX recommendation service.
"""

from .config.settings import Settings, get_settings
from .database.mongo_client import create_mongo_client, init_mongo_indexes
from .cache.redis_cache import RedisCacheAdapter, build_redis_client
from .security.internal_auth import verify_internal_service_key
from .security.pseudonymization import compute_pseudonymous_user_id
from .observability.logging import logger, log_structured_event
from .observability.metrics import metrics

__all__ = [
    "Settings",
    "get_settings",
    "create_mongo_client",
    "init_mongo_indexes",
    "RedisCacheAdapter",
    "build_redis_client",
    "verify_internal_service_key",
    "compute_pseudonymous_user_id",
    "logger",
    "log_structured_event",
    "metrics",
]
