"""
Record Interactions Use Case.
Validates, gates authoritative business transactions, verifies product catalog visibility,
applies deduplication windows, and triggers O(1) cache invalidation.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId

from ...domain.exceptions import (
    AuthenticationError,
    DuplicateEventConflictError,
    ProductNotFoundError,
    AuctionModeratedError,
    ServiceUnavailableError,
)
from ...domain.models.interaction import InteractionRecord, InteractionType
from ...domain.ranking.features import INTERACTION_WEIGHTS
from ..ports.auction_repository import AuctionRepository
from ..ports.interaction_repository import InteractionRepository
from ..ports.cache import CachePort
from ...infrastructure.security.internal_auth import verify_internal_service_key
from ...infrastructure.security.pseudonymization import compute_pseudonymous_user_id


class RecordInteractionsUseCase:
    """Use case coordinating single and batch telemetry event processing."""

    def __init__(
        self,
        auction_repo: AuctionRepository,
        interaction_repo: InteractionRepository,
        cache: Optional[CachePort] = None,
        internal_service_key: Optional[str] = None,
    ):
        self.auction_repo = auction_repo
        self.interaction_repo = interaction_repo
        self.cache = cache
        self.internal_service_key = internal_service_key

    def execute_single(
        self,
        interaction_dict: Dict[str, Any],
        incoming_service_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Processes a single telemetry event."""
        email = interaction_dict.get("email")
        session_id = interaction_dict.get("session_id")
        user_id = interaction_dict.get("user_id")
        product_id = interaction_dict.get("product_id")
        raw_itype = interaction_dict.get("interaction_type") or "view"
        event_id = interaction_dict.get("event_id")
        recommendation_id = interaction_dict.get("recommendation_id")
        position = interaction_dict.get("position")
        surface = interaction_dict.get("surface")
        ts = interaction_dict.get("timestamp")

        clean_email = email.strip().lower() if email else ""
        clean_session_id = session_id.strip() if session_id else ""
        clean_user_id = (
            compute_pseudonymous_user_id(clean_email)
            if clean_email
            else (user_id.strip() if user_id else None)
        )
        clean_rec_id = recommendation_id.strip() if recommendation_id else None

        # 1. Validation
        if not clean_email and not clean_session_id and not clean_user_id:
            raise ValueError("User email or session_id is required")

        if clean_session_id and len(clean_session_id) > 64:
            raise ValueError("session_id exceeds maximum length of 64 characters")

        if clean_rec_id and len(clean_rec_id) > 64:
            raise ValueError("recommendation_id exceeds maximum length of 64 characters")

        pid = product_id.strip() if product_id else ""
        if not pid or not ObjectId.is_valid(pid):
            raise ValueError("Invalid product_id")

        interaction_type = raw_itype.strip().lower()
        if interaction_type not in INTERACTION_WEIGHTS:
            raise ValueError(
                f"Invalid interaction_type: '{interaction_type}'. Must be one of {list(INTERACTION_WEIGHTS.keys())}"
            )

        # 2. Authoritative Event Guard
        if InteractionType.is_authoritative(interaction_type):
            if not clean_email:
                raise ValueError(f"Authoritative business event '{interaction_type}' requires a user email")
            if not self.internal_service_key:
                raise ServiceUnavailableError(
                    service_name="internal_auth",
                    reason="Authoritative event tracking is disabled: INTERNAL_SERVICE_KEY is not configured",
                )
            if not verify_internal_service_key(incoming_service_key, self.internal_service_key):
                raise AuthenticationError(
                    f"Authoritative business event '{interaction_type}' requires valid internal service credentials"
                )

        # 3. Idempotency Check
        clean_event_id = event_id.strip() if event_id else None
        if clean_event_id:
            existing_event = self.interaction_repo.find_event_by_id(clean_event_id)
            if existing_event:
                if (
                    (existing_event.get("email") and existing_event.get("email") != clean_email)
                    or (existing_event.get("product_id") and str(existing_event.get("product_id")) != pid)
                    or (existing_event.get("interaction_type") and existing_event.get("interaction_type") != interaction_type)
                ):
                    raise DuplicateEventConflictError(event_id=clean_event_id)
                return {"status": "success", "tracked": True, "idempotent_duplicate": True}

        # 4. Product Existence and Moderation Validation
        product_doc = self.auction_repo.get_product_by_id(pid)
        if not product_doc:
            raise ProductNotFoundError(product_id=pid)

        if product_doc.get("isModerated") is True:
            raise AuctionModeratedError("MODERATED")

        mod_status = str(product_doc.get("moderationStatus", "ACTIVE")).upper()
        if mod_status in ("REMOVED", "SUSPENDED"):
            raise AuctionModeratedError(mod_status)

        # 5. Timestamp Normalization
        now_utc = datetime.now(timezone.utc)
        event_time = ts or now_utc
        if isinstance(event_time, str):
            from ...domain.policies.auction_eligibility import parse_iso_or_legacy_date
            parsed_dt = parse_iso_or_legacy_date(event_time)
            event_time = parsed_dt or now_utc
        elif event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)
        if event_time > now_utc:
            event_time = now_utc

        # 6. Deduplication Window Check
        window_seconds = 300 if interaction_type == "impression" else 30
        cutoff = event_time - timedelta(seconds=window_seconds)
        duplicate = self.interaction_repo.find_recent_duplicate(
            product_id=pid,
            interaction_type=interaction_type,
            cutoff=cutoff,
            email=clean_email if clean_email else None,
            user_id=clean_user_id,
            session_id=clean_session_id if clean_session_id else None,
            recommendation_id=clean_rec_id,
        )
        if duplicate:
            return {"status": "success", "tracked": True, "duplicate": True}

        # 7. Persistence
        record_payload: Dict[str, Any] = {
            "product_id": pid,
            "interaction_type": interaction_type,
            "timestamp": event_time,
        }
        if clean_email:
            record_payload["email"] = clean_email
            record_payload["user_id"] = clean_user_id
        elif clean_user_id:
            record_payload["user_id"] = clean_user_id
        if clean_session_id:
            record_payload["session_id"] = clean_session_id
        if clean_event_id:
            record_payload["event_id"] = clean_event_id
        if clean_rec_id:
            record_payload["recommendation_id"] = clean_rec_id
        if position is not None:
            record_payload["position"] = int(position)
        if surface:
            record_payload["surface"] = str(surface).strip()

        insert_res = self.interaction_repo.insert_interaction(record_payload)
        if insert_res == "idempotent_duplicate":
            return {"status": "success", "tracked": True, "idempotent_duplicate": True}

        # 8. Cache Invalidation
        if self.cache and self.cache.is_available() and interaction_type != "impression":
            if clean_email:
                self.cache.increment_user_cache_version(clean_email)
            elif clean_session_id:
                self.cache.delete(f"recommendations:session:{clean_session_id}:10")

        return {"status": "success", "tracked": True}

    def execute_batch(
        self,
        interactions: List[Dict[str, Any]],
        incoming_service_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Processes a batch of interactions (maximum 25 items)."""
        if not interactions:
            return {"status": "success", "success": True, "processed_count": 0, "results": []}

        if len(interactions) > 25:
            raise ValueError("Batch size exceeds maximum limit of 25 interactions")

        results = []
        for item in interactions:
            res = self.execute_single(item, incoming_service_key=incoming_service_key)
            results.append(res)

        return {
            "status": "success",
            "success": True,
            "processed_count": len(results),
            "results": results,
        }
