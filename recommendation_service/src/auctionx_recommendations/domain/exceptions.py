"""
Domain exceptions for AuctionX Recommendation Service.
These domain-level exceptions encapsulate business and ranking rule violations
independently of any HTTP transport or database engine.
"""

from typing import Optional


class RecommendationDomainError(Exception):
    """Base exception for all domain-specific errors in the recommendation engine."""

    def __init__(self, message: str, code: str = "DOMAIN_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


class AuctionIneligibleError(RecommendationDomainError):
    """Raised when an auction cannot be recommended due to lifecycle or governance state."""

    def __init__(self, reason: str, details: Optional[str] = None):
        super().__init__(f"Auction is ineligible for recommendations: {reason}", code="INELIGIBLE_AUCTION")
        self.reason = reason
        self.details = details


class AuctionModeratedError(AuctionIneligibleError):
    """Raised when an auction has been flagged, suspended, or removed by moderation."""

    def __init__(self, moderation_status: str):
        super().__init__(reason=f"MODERATION_{moderation_status.upper()}")
        self.moderation_status = moderation_status


class DuplicateEventConflictError(RecommendationDomainError):
    """Raised when an event ID is re-submitted with conflicting interaction attributes."""

    def __init__(self, event_id: str):
        super().__init__(
            f"Conflict: event_id '{event_id}' was already recorded with different interaction attributes",
            code="DUPLICATE_EVENT_CONFLICT",
        )
        self.event_id = event_id


class ProductNotFoundError(RecommendationDomainError):
    """Raised when a referenced product cannot be found in the catalog."""

    def __init__(self, product_id: str):
        super().__init__(f"Product not found: {product_id}", code="PRODUCT_NOT_FOUND")
        self.product_id = product_id


class AuthenticationError(RecommendationDomainError):
    """Raised when internal service credentials are missing, invalid, or mismatched."""

    def __init__(self, message: str = "Internal service authorization failed"):
        super().__init__(message, code="AUTH_FAILED")


class ServiceUnavailableError(RecommendationDomainError):
    """Raised when an essential dependent service (e.g. database) is unconfigured or unreachable."""

    def __init__(self, service_name: str, reason: str):
        super().__init__(f"Service '{service_name}' is unavailable: {reason}", code="SERVICE_UNAVAILABLE")
        self.service_name = service_name
        self.reason = reason
