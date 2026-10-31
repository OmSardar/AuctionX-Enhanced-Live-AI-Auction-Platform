"""
Abstract port interface for auction catalog data access.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class AuctionRepository(ABC):
    """Port interface for querying product and auction candidate data."""

    @abstractmethod
    def get_product_by_id(self, product_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single product by its ObjectId string representation."""
        pass

    @abstractmethod
    def get_products_by_ids(self, product_ids: List[str], projection: Optional[Dict[str, int]] = None) -> List[Dict[str, Any]]:
        """Fetch multiple products by their ObjectId string representations."""
        pass

    @abstractmethod
    def get_candidates_by_categories(self, categories: List[str], limit: int) -> List[Dict[str, Any]]:
        """Retrieve eligible candidates matching top user affinity categories."""
        pass

    @abstractmethod
    def get_popular_active_candidates(self, limit: int) -> List[Dict[str, Any]]:
        """Retrieve active auctions sorted by bidCount and creation date."""
        pass

    @abstractmethod
    def get_fresh_active_candidates(self, limit: int) -> List[Dict[str, Any]]:
        """Retrieve newly created active auctions."""
        pass

    @abstractmethod
    def get_upcoming_candidates(self, limit: int) -> List[Dict[str, Any]]:
        """Retrieve scheduled/draft auctions to backfill sparse candidate sets."""
        pass
