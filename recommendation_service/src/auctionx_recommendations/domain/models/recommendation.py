"""
Recommendation ranking and presentation domain models.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class FeatureScores:
    """Normalized individual feature sub-scores bounded in [0.0, 1.0]."""

    category_affinity: float
    collaborative: float
    popularity: float
    freshness: float
    urgency: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "category_affinity": self.category_affinity,
            "collaborative": self.collaborative,
            "popularity": self.popularity,
            "freshness": self.freshness,
            "urgency": self.urgency,
        }


@dataclass
class RankedRecommendation:
    """An individual candidate scored and formatted for response payloads."""

    product: Dict[str, Any]
    score: float
    features: FeatureScores
    is_live: bool
    is_viewed: bool


@dataclass
class RecommendationSlate:
    """A complete recommended set returned to the client gateway."""

    recommendation_id: str
    items: Any
    personalized: bool
    cache_hit: bool = False
    diagnostics: Optional[Dict[str, Any]] = None

    @property
    def count(self) -> int:
        if isinstance(self.items, (list, tuple, set)):
            return len(self.items)
        if isinstance(self.items, int):
            return self.items
        return 0

    def to_response_dict(self) -> Dict[str, Any]:
        """Formats the response to match the existing frontend and proxy contract."""
        return {
            "recommendation_id": self.recommendation_id,
            "products": self.items,
            "recommendations": self.items,
            "count": self.count,
            "cache_hit": self.cache_hit,
            "personalized": self.personalized,
            "diagnostics": self.diagnostics,
        }

