"""
MongoDB implementation of the AuctionRepository port.
"""

from typing import Any, Dict, List, Optional
from bson import ObjectId
from pymongo.database import Database

from ....application.ports.auction_repository import AuctionRepository

# Standard product projection to optimize memory, deserialization, and network payload
PRODUCT_PROJECTION: Dict[str, int] = {
    "_id": 1,
    "name": 1,
    "description": 1,
    "category": 1,
    "images": 1,
    "startingPrice": 1,
    "biddingStartPrice": 1,
    "currentPrice": 1,
    "bidCount": 1,
    "viewCount": 1,
    "status": 1,
    "isModerated": 1,
    "moderationStatus": 1,
    "startTime": 1,
    "endTime": 1,
    "biddingStartDate": 1,
    "biddingStartTime": 1,
    "biddingEndTime": 1,
    "hasBanner": 1,
    "createdAt": 1,
}


class MongoAuctionRepository(AuctionRepository):
    """MongoDB adapter for catalog queries."""

    def __init__(self, db: Database):
        self._db = db

    def get_product_by_id(self, product_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single product by its ObjectId."""
        if not product_id or not ObjectId.is_valid(product_id):
            return None
        return self._db.products.find_one(
            {"_id": ObjectId(product_id)},
            {"_id": 1, "isModerated": 1, "moderationStatus": 1, "name": 1, "category": 1},
        )

    def get_products_by_ids(self, product_ids: List[str], projection: Optional[Dict[str, int]] = None) -> List[Dict[str, Any]]:
        """Fetch multiple products by their ObjectIds."""
        valid_oids = [ObjectId(pid) for pid in product_ids if ObjectId.is_valid(pid)]
        if not valid_oids:
            return []
        proj = projection or PRODUCT_PROJECTION
        return list(self._db.products.find({"_id": {"$in": valid_oids}}, proj))

    def get_candidates_by_categories(self, categories: List[str], limit: int) -> List[Dict[str, Any]]:
        """Retrieve eligible candidates matching top user affinity categories."""
        if not categories:
            return []
        return list(
            self._db.products.find(
                {
                    "category": {"$in": categories},
                    "isModerated": {"$ne": True},
                    "moderationStatus": {"$nin": ["REMOVED", "SUSPENDED"]},
                    "status": {"$in": ["Active", "LIVE", "SCHEDULED", "DRAFT"]},
                },
                PRODUCT_PROJECTION,
            )
            .sort([("bidCount", -1), ("createdAt", -1)])
            .limit(limit)
        )

    def get_popular_active_candidates(self, limit: int) -> List[Dict[str, Any]]:
        """Retrieve active auctions sorted by bidCount and creation date."""
        return list(
            self._db.products.find(
                {
                    "status": {"$in": ["Active", "LIVE"]},
                    "isModerated": {"$ne": True},
                    "moderationStatus": {"$nin": ["REMOVED", "SUSPENDED"]},
                },
                PRODUCT_PROJECTION,
            )
            .sort([("bidCount", -1), ("createdAt", -1)])
            .limit(limit)
        )

    def get_fresh_active_candidates(self, limit: int) -> List[Dict[str, Any]]:
        """Retrieve newly created active auctions."""
        return list(
            self._db.products.find(
                {
                    "status": {"$in": ["Active", "LIVE"]},
                    "isModerated": {"$ne": True},
                    "moderationStatus": {"$nin": ["REMOVED", "SUSPENDED"]},
                },
                PRODUCT_PROJECTION,
            )
            .sort("createdAt", -1)
            .limit(limit)
        )

    def get_upcoming_candidates(self, limit: int) -> List[Dict[str, Any]]:
        """Retrieve scheduled/draft auctions to backfill sparse candidate sets."""
        return list(
            self._db.products.find(
                {
                    "status": {"$in": ["SCHEDULED", "DRAFT"]},
                    "isModerated": {"$ne": True},
                    "moderationStatus": {"$nin": ["REMOVED", "SUSPENDED"]},
                },
                PRODUCT_PROJECTION,
            )
            .sort([("startTime", 1), ("createdAt", -1)])
            .limit(limit)
        )
