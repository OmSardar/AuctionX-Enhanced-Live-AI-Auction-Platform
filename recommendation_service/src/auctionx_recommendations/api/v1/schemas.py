"""
Pydantic validation schemas for API transport.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class InteractionSchema(BaseModel):
    """Payload schema for client telemetry interaction."""

    email: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = None  # Keyed HMAC pseudonymous identifier
    product_id: str
    interaction_type: str = "view"
    event_id: Optional[str] = None
    recommendation_id: Optional[str] = None
    position: Optional[int] = None
    surface: Optional[str] = None
    timestamp: Optional[datetime] = None


class BatchInteractionRequestSchema(BaseModel):
    """Payload schema for batch telemetry events."""

    interactions: Optional[List[InteractionSchema]] = None
    batch: Optional[List[InteractionSchema]] = None


class RecommendationRequestSchema(BaseModel):
    """Payload schema for explicit recommendation request."""

    email: str
    count: int = Field(default=10, ge=1, le=50)
