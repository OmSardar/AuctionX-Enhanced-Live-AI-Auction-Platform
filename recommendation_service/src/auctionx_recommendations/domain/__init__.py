"""
Domain layer for AuctionX recommendation service.
"""

from .exceptions import (
    RecommendationDomainError,
    AuctionIneligibleError,
    AuctionModeratedError,
    DuplicateEventConflictError,
    ProductNotFoundError,
    AuthenticationError,
    ServiceUnavailableError,
)

__all__ = [
    "RecommendationDomainError",
    "AuctionIneligibleError",
    "AuctionModeratedError",
    "DuplicateEventConflictError",
    "ProductNotFoundError",
    "AuthenticationError",
    "ServiceUnavailableError",
]
