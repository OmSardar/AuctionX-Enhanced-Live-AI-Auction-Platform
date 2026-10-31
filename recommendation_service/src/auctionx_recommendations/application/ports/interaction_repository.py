"""
Abstract port interface for interaction telemetry data access.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional


class InteractionRepository(ABC):
    """Port interface for recording and querying user interaction telemetry."""

    @abstractmethod
    def find_event_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Look up an authoritative event by its client-supplied idempotent event_id."""
        pass

    @abstractmethod
    def find_recent_duplicate(
        self,
        product_id: str,
        interaction_type: str,
        cutoff: datetime,
        email: Optional[str] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        recommendation_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Check for identical interactions within the deduplication window."""
        pass

    @abstractmethod
    def insert_interaction(self, interaction_data: Dict[str, Any]) -> str:
        """Persist a validated interaction document."""
        pass

    @abstractmethod
    def get_user_interactions(self, email: Optional[str], user_id: Optional[str], limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve recent interaction history for an authenticated or pseudonymous user."""
        pass

    @abstractmethod
    def get_session_interactions(self, session_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve recent interaction history for an active guest session."""
        pass

    @abstractmethod
    def get_co_interactions(self, product_ids: List[str], exclude_email: Optional[str] = None, exclude_user_id: Optional[str] = None, limit: int = 300) -> List[Dict[str, Any]]:
        """Retrieve interactions from other users on the same set of products."""
        pass

    @abstractmethod
    def get_similar_user_interactions(self, user_identifiers: List[str], exclude_product_ids: List[str], limit: int = 500) -> List[Dict[str, Any]]:
        """Retrieve interactions from similar users on products the target user has not yet interacted with."""
        pass
