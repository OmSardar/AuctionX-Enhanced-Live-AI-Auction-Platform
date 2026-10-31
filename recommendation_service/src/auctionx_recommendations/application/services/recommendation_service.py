"""
Recommendation application service.
Facade over recommendation use cases and pipeline operations.
"""

from typing import Any, Dict, List, Optional, Tuple

from ...domain.models.recommendation import RecommendationSlate
from ..use_cases.get_recommendations import GetRecommendationsUseCase


class RecommendationService:
    """Application service for recommendation generation."""

    def __init__(self, get_recommendations_uc: GetRecommendationsUseCase):
        self.get_recommendations_uc = get_recommendations_uc

    def get_recommendations(
        self,
        email: Optional[str] = None,
        count: int = 10,
        session_id: Optional[str] = None,
        include_diagnostics: bool = True,
    ) -> RecommendationSlate:
        """Serve recommendations with caching."""
        return self.get_recommendations_uc.execute(
            email=email,
            count=count,
            session_id=session_id,
            include_diagnostics=include_diagnostics,
        )

    def compute_raw(
        self,
        email: str,
        count: int = 10,
        include_diagnostics: bool = False,
        session_id: Optional[str] = None,
    ) -> Any:
        """Direct computation matching legacy compute_recommendations contract."""
        ranked, is_pers, diag = self.get_recommendations_uc.compute_raw_recommendations(
            email=email,
            count=count,
            session_id=session_id,
        )
        if include_diagnostics:
            return ranked, is_pers, diag
        return ranked, is_pers
