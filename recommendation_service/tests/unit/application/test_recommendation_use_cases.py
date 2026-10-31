"""
Unit tests for GetRecommendationsUseCase and RecordInteractionsUseCase with mock ports.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock
import pytest

from auctionx_recommendations.application.use_cases.get_recommendations import GetRecommendationsUseCase
from auctionx_recommendations.application.use_cases.record_interactions import RecordInteractionsUseCase
from auctionx_recommendations.domain.exceptions import (
    AuthenticationError,
    DuplicateEventConflictError,
    ProductNotFoundError,
    AuctionModeratedError,
)


class TestRecommendationUseCases:
    """Verifies use case business logic against port mocks."""

    def test_record_authoritative_event_without_key_rejected(self):
        auction_repo = MagicMock()
        interaction_repo = MagicMock()
        cache = MagicMock()

        uc = RecordInteractionsUseCase(
            auction_repo=auction_repo,
            interaction_repo=interaction_repo,
            cache=cache,
            internal_service_key="mock_internal_key",
        )

        payload = {
            "email": "buyer@test.com",
            "product_id": "60c72b2f9b1d8b2bad000001",
            "interaction_type": "bid",
        }

        with pytest.raises(AuthenticationError):
            uc.execute_single(payload, incoming_service_key="wrong_key")

    def test_record_interaction_moderated_product_rejected(self):
        auction_repo = MagicMock()
        interaction_repo = MagicMock()
        cache = MagicMock()

        # Product is flagged as moderated
        auction_repo.get_product_by_id.return_value = {
            "_id": "60c72b2f9b1d8b2bad000001",
            "isModerated": True,
            "moderationStatus": "REMOVED",
        }

        uc = RecordInteractionsUseCase(
            auction_repo=auction_repo,
            interaction_repo=interaction_repo,
            cache=cache,
        )

        payload = {
            "email": "user@test.com",
            "product_id": "60c72b2f9b1d8b2bad000001",
            "interaction_type": "view",
        }

        with pytest.raises(AuctionModeratedError):
            uc.execute_single(payload)

    def test_record_interaction_idempotent_duplicate_handled(self):
        auction_repo = MagicMock()
        interaction_repo = MagicMock()
        cache = MagicMock()

        pid = "60c72b2f9b1d8b2bad000001"
        event_id = "bid_unique_999"

        # Event already recorded with identical attributes
        interaction_repo.find_event_by_id.return_value = {
            "email": "user@test.com",
            "product_id": pid,
            "interaction_type": "bid",
            "event_id": event_id,
        }

        uc = RecordInteractionsUseCase(
            auction_repo=auction_repo,
            interaction_repo=interaction_repo,
            cache=cache,
            internal_service_key="secret",
        )

        payload = {
            "email": "user@test.com",
            "product_id": pid,
            "interaction_type": "bid",
            "event_id": event_id,
        }

        res = uc.execute_single(payload, incoming_service_key="secret")
        assert res["status"] == "success"
        assert res["idempotent_duplicate"] is True

    def test_empty_candidates_returns_empty_slate_cleanly(self):
        auction_repo = MagicMock()
        interaction_repo = MagicMock()
        cache = MagicMock()
        cache.is_available.return_value = False

        interaction_repo.get_user_interactions.return_value = []
        auction_repo.get_candidates_by_categories.return_value = []
        auction_repo.get_products_by_ids.return_value = []
        auction_repo.get_popular_active_candidates.return_value = []
        auction_repo.get_fresh_active_candidates.return_value = []
        auction_repo.get_upcoming_candidates.return_value = []

        uc = GetRecommendationsUseCase(
            auction_repo=auction_repo,
            interaction_repo=interaction_repo,
            cache=cache,
        )

        slate = uc.execute(email="newuser@example.com", count=10)
        assert slate.count == 0
        assert slate.items == []
        assert slate.cache_hit is False
