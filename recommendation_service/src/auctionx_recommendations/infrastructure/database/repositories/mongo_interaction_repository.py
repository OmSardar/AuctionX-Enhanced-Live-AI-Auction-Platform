"""
MongoDB implementation of the InteractionRepository port.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from bson import ObjectId
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from ....application.ports.interaction_repository import InteractionRepository
from ....domain.exceptions import DuplicateEventConflictError


class MongoInteractionRepository(InteractionRepository):
    """MongoDB adapter for recording and querying telemetry signals."""

    def __init__(self, db: Database):
        self._db = db

    def find_event_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Look up an event by its idempotency key."""
        if not event_id:
            return None
        return self._db.user_interactions.find_one({"event_id": event_id.strip()})

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
        """Check for identical interactions within the sliding deduplication window."""
        dedup_query: Dict[str, Any] = {
            "product_id": product_id,
            "interaction_type": interaction_type,
            "timestamp": {"$gte": cutoff},
        }
        if recommendation_id:
            dedup_query["recommendation_id"] = recommendation_id

        if email:
            dedup_query["$or"] = [{"email": email}, {"user_id": user_id}]
        elif user_id:
            dedup_query["user_id"] = user_id
        elif session_id:
            dedup_query["session_id"] = session_id
        else:
            return None

        return self._db.user_interactions.find_one(dedup_query)

    def insert_interaction(self, interaction_data: Dict[str, Any]) -> str:
        """
        Persists an interaction document into MongoDB.
        Translates concurrent event_id collisions into idempotent checks or domain conflicts.
        """
        try:
            result = self._db.user_interactions.insert_one(interaction_data)
            return str(result.inserted_id)
        except DuplicateKeyError as dup_err:
            event_id = interaction_data.get("event_id")
            err_msg = str(dup_err)
            if event_id and ("event_id" in err_msg or "event_id_1" in err_msg):
                existing = self.find_event_by_id(event_id)
                if existing:
                    # Verify conflict on attributes
                    if (
                        (existing.get("email") and existing.get("email") != interaction_data.get("email"))
                        or (existing.get("product_id") and str(existing.get("product_id")) != str(interaction_data.get("product_id")))
                        or (existing.get("interaction_type") and existing.get("interaction_type") != interaction_data.get("interaction_type"))
                    ):
                        raise DuplicateEventConflictError(event_id=event_id)
                    # Safe idempotent duplicate
                    return "idempotent_duplicate"
            raise dup_err

    def get_user_interactions(self, email: Optional[str], user_id: Optional[str], limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve recent interaction history for a user."""
        query_conditions = []
        if email:
            query_conditions.append({"email": email})
        if user_id:
            query_conditions.append({"user_id": user_id})

        if not query_conditions:
            return []

        query = {"$or": query_conditions} if len(query_conditions) > 1 else query_conditions[0]
        return list(
            self._db.user_interactions.find(query)
            .sort("timestamp", -1)
            .limit(limit)
        )

    def get_session_interactions(self, session_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve recent interaction history for an active guest session."""
        if not session_id:
            return []
        return list(
            self._db.user_interactions.find({"session_id": session_id})
            .sort("timestamp", -1)
            .limit(limit)
        )

    def get_co_interactions(
        self,
        product_ids: List[str],
        exclude_email: Optional[str] = None,
        exclude_user_id: Optional[str] = None,
        limit: int = 300,
    ) -> List[Dict[str, Any]]:
        """Retrieve interactions from other users on the same set of products."""
        if not product_ids:
            return []

        co_filter: Dict[str, Any] = {
            "product_id": {"$in": product_ids},
        }
        if exclude_email:
            co_filter["email"] = {"$ne": exclude_email}
        if exclude_user_id:
            co_filter["user_id"] = {"$ne": exclude_user_id}

        return list(self._db.user_interactions.find(co_filter).limit(limit))

    def get_similar_user_interactions(
        self,
        user_identifiers: List[str],
        exclude_product_ids: List[str],
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        """Retrieve interactions from similar users on products target has not yet touched."""
        if not user_identifiers:
            return []

        query = {
            "$or": [
                {"email": {"$in": user_identifiers}},
                {"user_id": {"$in": user_identifiers}},
            ],
            "product_id": {"$nin": exclude_product_ids},
        }
        return list(self._db.user_interactions.find(query).limit(limit))
