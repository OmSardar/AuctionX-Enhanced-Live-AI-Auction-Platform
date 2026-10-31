"""
API transport layer.
"""

from .v1.router import api_v1_router
from .dependencies import (
    get_settings,
    get_auction_repository,
    get_interaction_repository,
    get_cache,
    get_recommendation_service,
    get_interaction_service,
)
from .exception_handlers import register_exception_handlers
from .middleware.request_id import RequestIdMiddleware
from .middleware.access_logging import AccessLoggingMiddleware

__all__ = [
    "api_v1_router",
    "get_settings",
    "get_auction_repository",
    "get_interaction_repository",
    "get_cache",
    "get_recommendation_service",
    "get_interaction_service",
    "register_exception_handlers",
    "RequestIdMiddleware",
    "AccessLoggingMiddleware",
]
