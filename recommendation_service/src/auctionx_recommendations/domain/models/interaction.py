"""
Interaction telemetry domain models.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional


class InteractionType(str, Enum):
    """Supported interaction intent events."""

    PURCHASE = "purchase"
    BID = "bid"
    CLICK = "click"
    VIEW = "view"
    IMPRESSION = "impression"

    @classmethod
    def is_authoritative(cls, event_type: str) -> bool:
        """Determines if the event must originate from authenticated backend services."""
        return event_type.lower() in (cls.PURCHASE.value, cls.BID.value)

    @classmethod
    def is_client_allowed(cls, event_type: str) -> bool:
        """Determines if the event can be emitted directly by client browser sessions."""
        return event_type.lower() in (cls.CLICK.value, cls.VIEW.value, cls.IMPRESSION.value)


@dataclass(frozen=True)
class InteractionRecord:
    """Domain model of a validated user-auction telemetry interaction."""

    product_id: str
    interaction_type: InteractionType
    timestamp: datetime
    email: Optional[str] = None
    user_id: Optional[str] = None  # Keyed HMAC pseudonymous identifier
    session_id: Optional[str] = None
    event_id: Optional[str] = None
    recommendation_id: Optional[str] = None
    position: Optional[int] = None
    surface: Optional[str] = None
