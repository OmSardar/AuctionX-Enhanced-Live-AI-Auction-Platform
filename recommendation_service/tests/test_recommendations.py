import os
import sys

# Ensure recommendation_service directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from bson import ObjectId
from datetime import datetime
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from main import app, compute_recommendations, build_redis_client


@pytest.fixture
def client():
    """Create a TestClient with lifespan context."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def mock_db():
    """Provide a mock MongoDB database with realistic collections."""
    db = MagicMock()
    # Mock user_interactions collection
    db.user_interactions = MagicMock()
    db.user_interactions.find_one.return_value = None
    # Mock products collection
    db.products = MagicMock()
    db.name = "Auction-X"
    return db


@pytest.fixture(autouse=True)
def isolate_redis_cache():
    """Ensure live Redis cache is flushed before and after each test to prevent cross-test leakage."""
    import main
    if getattr(main, "redis_client", None) is not None:
        try:
            main.redis_client.flushdb()
        except Exception:
            pass
    yield
    if getattr(main, "redis_client", None) is not None:
        try:
            main.redis_client.flushdb()
        except Exception:
            pass


# ==============================================================================
# 1. Health & Readiness Tests
# ==============================================================================
class TestHealthAndReadiness:
    def test_liveness_probe_health(self, client):
        """Verify liveness probe returns HTTP 200 on both /health and /api/health."""
        for path in ["/health", "/api/health"]:
            response = client.get(path)
            assert response.status_code == 200
            data = response.json()
            assert "status" in data
            assert data["service"] == "recommendation_service"
            assert "mongodb" in data
            assert "redis" in data

    def test_readiness_probe_success(self, client):
        """Verify readiness probe returns 200 when MongoDB ping succeeds."""
        with patch("main.mongo_client") as mock_client:
            mock_client.admin.command.return_value = {"ok": 1}
            for path in ["/ready", "/api/ready"]:
                response = client.get(path)
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "ready"
                assert data["mongodb"] is True

    def test_readiness_probe_failure_503(self, client):
        """Verify readiness probe returns 503 when MongoDB is unavailable."""
        with patch("main.mongo_client") as mock_client:
            mock_client.admin.command.side_effect = Exception("Connection timeout")
            for path in ["/ready", "/api/ready"]:
                response = client.get(path)
                assert response.status_code == 503
                data = response.json()
                assert "Database readiness ping failed" in data["detail"]


# ==============================================================================
# 2. Tracking Endpoint Validation & Error Handling
# ==============================================================================
class TestInteractionTracking:
    def test_track_valid_interaction(self, client, mock_db):
        """Verify tracking valid interaction on both /api/track and /track."""
        valid_pid = str(ObjectId())
        payload = {
            "email": "buyer@example.com",
            "product_id": valid_pid,
            "interaction_type": "view",
        }
        mock_db.products.find_one.return_value = {
            "_id": ObjectId(valid_pid),
            "isModerated": False,
            "moderationStatus": "ACTIVE",
        }

        with patch("main.db", mock_db):
            for path in ["/api/track", "/track"]:
                response = client.post(path, json=payload)
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "success"
                assert data["tracked"] is True

    def test_track_missing_email_rejected_400(self, client):
        """Verify missing or empty email returns HTTP 400 when session_id is also absent."""
        payload = {
            "email": "   ",
            "product_id": str(ObjectId()),
            "interaction_type": "view",
        }
        response = client.post("/api/track", json=payload)
        assert response.status_code == 400
        assert "User email or session_id is required" in response.json()["detail"]

    def test_track_anonymous_guest_with_session_id(self, client, mock_db):
        """Verify anonymous guest interaction can be tracked with session_id."""
        valid_pid = str(ObjectId())
        payload = {
            "session_id": "sess_guest_uuid_12345",
            "product_id": valid_pid,
            "interaction_type": "click",
            "recommendation_id": "rec_uuid_slate_6789",
        }
        mock_db.products.find_one.return_value = {
            "_id": ObjectId(valid_pid),
            "isModerated": False,
            "moderationStatus": "ACTIVE",
        }
        mock_db.user_interactions.find_one.return_value = None

        with patch("main.db", mock_db):
            response = client.post("/api/track", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["tracked"] is True
            # Verify persistence captured session_id and recommendation_id
            inserted = mock_db.user_interactions.insert_one.call_args[0][0]
            assert inserted["session_id"] == "sess_guest_uuid_12345"
            assert inserted["recommendation_id"] == "rec_uuid_slate_6789"
            assert inserted["interaction_type"] == "click"
            assert "email" not in inserted

    def test_track_authoritative_event_without_email_rejected_400(self, client, mock_db):
        """Verify authoritative events cannot be recorded with only session_id (email strictly required)."""
        valid_pid = str(ObjectId())
        payload = {
            "session_id": "sess_guest_uuid_12345",
            "product_id": valid_pid,
            "interaction_type": "bid",
        }
        headers = {"x-internal-service-key": "test_internal_auctionx_secret_key"}
        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", "test_internal_auctionx_secret_key"):
            response = client.post("/api/track", json=payload, headers=headers)
            assert response.status_code == 400
            assert "requires a user email" in response.json()["detail"]

    def test_track_invalid_product_id_rejected_400(self, client):
        """Verify malformed product_id is rejected with HTTP 400."""
        payload = {
            "email": "buyer@example.com",
            "product_id": "not-a-valid-object-id",
            "interaction_type": "view",
        }
        response = client.post("/api/track", json=payload)
        assert response.status_code == 400
        assert "Invalid product_id" in response.json()["detail"]

    def test_track_client_forged_bid_rejected_403(self, client, mock_db):
        """Verify client cannot manufacture a bid interaction without internal service credentials."""
        valid_pid = str(ObjectId())
        payload = {
            "email": "attacker@example.com",
            "product_id": valid_pid,
            "interaction_type": "bid",
        }
        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", "test_internal_auctionx_secret_key"):
            response = client.post("/api/track", json=payload)
            assert response.status_code == 403
            assert "requires valid internal service credentials" in response.json()["detail"]

    def test_track_client_forged_purchase_rejected_403(self, client, mock_db):
        """Verify client cannot manufacture a purchase interaction without internal service credentials."""
        valid_pid = str(ObjectId())
        payload = {
            "email": "attacker@example.com",
            "product_id": valid_pid,
            "interaction_type": "purchase",
        }
        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", "test_internal_auctionx_secret_key"):
            response = client.post("/api/track", json=payload)
            assert response.status_code == 403
            assert "requires valid internal service credentials" in response.json()["detail"]

    def test_track_authoritative_bid_accepted_with_key(self, client, mock_db):
        """Verify authoritative bid interaction succeeds when accompanied by internal service key."""
        valid_pid = str(ObjectId())
        mock_db.products.find_one.return_value = {
            "_id": ObjectId(valid_pid),
            "isModerated": False,
            "moderationStatus": "ACTIVE",
        }
        payload = {
            "email": "legitbuyer@example.com",
            "product_id": valid_pid,
            "interaction_type": "bid",
        }
        headers = {"x-internal-service-key": "test_internal_auctionx_secret_key"}
        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", "test_internal_auctionx_secret_key"):
            response = client.post("/api/track", json=payload, headers=headers)
            assert response.status_code == 200
            assert response.json()["status"] == "success"

    def test_track_authoritative_purchase_accepted_with_key(self, client, mock_db):
        """Verify authoritative purchase interaction succeeds when accompanied by internal service key."""
        valid_pid = str(ObjectId())
        mock_db.products.find_one.return_value = {
            "_id": ObjectId(valid_pid),
            "isModerated": False,
            "moderationStatus": "ACTIVE",
        }
        payload = {
            "email": "settledbuyer@example.com",
            "product_id": valid_pid,
            "interaction_type": "purchase",
        }
        headers = {"x-internal-service-key": "test_internal_auctionx_secret_key"}
        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", "test_internal_auctionx_secret_key"):
            response = client.post("/api/track", json=payload, headers=headers)
            assert response.status_code == 200
            assert response.json()["status"] == "success"

    def test_track_nonexistent_product_rejected_404(self, client, mock_db):
        """Verify tracking non-existent product ID returns HTTP 404."""
        valid_pid = str(ObjectId())
        mock_db.products.find_one.return_value = None  # Not found
        payload = {
            "email": "user@example.com",
            "product_id": valid_pid,
            "interaction_type": "view",
        }
        with patch("main.db", mock_db):
            response = client.post("/api/track", json=payload)
            assert response.status_code == 404
            assert "Product not found" in response.json()["detail"]

    def test_track_moderated_or_suspended_product_rejected_403(self, client, mock_db):
        """Verify tracking moderated or suspended product is rejected with HTTP 403."""
        valid_pid = str(ObjectId())
        # Moderated product
        mock_db.products.find_one.return_value = {
            "_id": ObjectId(valid_pid),
            "isModerated": True,
            "moderationStatus": "ACTIVE",
        }
        payload = {
            "email": "user@example.com",
            "product_id": valid_pid,
            "interaction_type": "view",
        }
        with patch("main.db", mock_db):
            res_mod = client.post("/api/track", json=payload)
            assert res_mod.status_code == 403
            assert "moderated" in res_mod.json()["detail"]

        # Suspended product
        mock_db.products.find_one.return_value = {
            "_id": ObjectId(valid_pid),
            "isModerated": False,
            "moderationStatus": "SUSPENDED",
        }
        with patch("main.db", mock_db):
            res_susp = client.post("/api/track", json=payload)
            assert res_susp.status_code == 403
            assert "SUSPENDED" in res_susp.json()["detail"]

    def test_redis_cache_version_incremented_on_track(self, client, mock_db):
        """Verify tracking an interaction increments the atomic O(1) user cache version in Redis."""
        valid_pid = str(ObjectId())
        mock_db.products.find_one.return_value = {
            "_id": ObjectId(valid_pid),
            "isModerated": False,
            "moderationStatus": "ACTIVE",
        }
        payload = {
            "email": "cachetest@example.com",
            "product_id": valid_pid,
            "interaction_type": "view",
        }
        mock_redis = MagicMock()
        with patch("main.db", mock_db), patch("main.redis_client", mock_redis):
            res = client.post("/api/track", json=payload)
            assert res.status_code == 200
            mock_redis.incr.assert_called_once_with("user_rec_ver:cachetest@example.com")
            mock_redis.expire.assert_called_once_with("user_rec_ver:cachetest@example.com", 604800)


# ==============================================================================
# 3. Recommendation Routing, Schema & Algorithm Behavior
# ==============================================================================
class TestRecommendationPipeline:
    def test_dual_endpoint_routing(self, client, mock_db):
        """Verify recommendations are reachable via both /api/recommendations/ and /recommendations/."""
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value.limit.return_value = []
        mock_db.user_interactions.find.return_value = mock_cursor
        mock_db.products.find.return_value.sort.return_value.limit.return_value = []

        with patch("main.db", mock_db):
            for path in [
                "/api/recommendations/test@example.com?count=4",
                "/recommendations/test@example.com?count=4",
            ]:
                response = client.get(path, headers={"x-internal-service-key": "test_internal_auctionx_secret_key"})
                assert response.status_code == 200
                data = response.json()
                assert "products" in data
                assert "recommendations" in data
                assert "recommendation_id" in data
                assert isinstance(data["products"], list)
                assert isinstance(data["recommendations"], list)
                assert "cache_hit" in data
                assert "personalized" in data

    def test_direct_user_recommendations_without_internal_key_rejected_403(self, client, mock_db):
        """Verify unauthenticated direct requests to /api/recommendations/{email} are rejected with 403."""
        with patch("main.db", mock_db):
            res = client.get("/api/recommendations/victim@example.com?count=5")
            assert res.status_code == 403
            assert "trusted internal service authorization" in res.json()["detail"]

    def test_direct_query_email_without_internal_key_rejected_403(self, client, mock_db):
        """Verify unauthenticated direct requests to /api/recommendations?email={email} are rejected with 403."""
        with patch("main.db", mock_db):
            res = client.get("/api/recommendations?email=victim@example.com&count=5")
            assert res.status_code == 403
            assert "trusted internal service authorization" in res.json()["detail"]

    def test_direct_user_recommendations_with_invalid_key_rejected_403(self, client, mock_db):
        """Verify requests with invalid internal service key are rejected with 403."""
        with patch("main.db", mock_db):
            res = client.get(
                "/api/recommendations/victim@example.com?count=5",
                headers={"x-internal-service-key": "wrong_spoofed_key"},
            )
            assert res.status_code == 403
            assert "trusted internal service authorization" in res.json()["detail"]

    def test_direct_user_recommendations_rejects_hmac_secret_as_internal_key(self, client, mock_db):
        """Verify that RECOMMENDATION_HMAC_SECRET cannot be used to authenticate as INTERNAL_SERVICE_KEY."""
        with patch("main.db", mock_db), \
             patch("main.INTERNAL_SERVICE_KEY", "dedicated_internal_secret_abc"), \
             patch.dict(os.environ, {"RECOMMENDATION_HMAC_SECRET": "dedicated_hmac_secret_xyz"}):
            res = client.get(
                "/api/recommendations/victim@example.com?count=5",
                headers={"x-internal-service-key": "dedicated_hmac_secret_xyz"},
            )
            assert res.status_code == 403
            assert "trusted internal service authorization" in res.json()["detail"]

    def test_direct_user_recommendations_accepts_valid_internal_key_200(self, client, mock_db):
        """Verify that requests with the valid dedicated INTERNAL_SERVICE_KEY are accepted."""
        mock_ui_cursor = MagicMock()
        mock_ui_cursor.sort.return_value.limit.return_value = []
        mock_db.user_interactions.find.return_value = mock_ui_cursor
        mock_db.products.find.return_value.sort.return_value.limit.return_value = []

        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", "dedicated_internal_secret_abc"):
            res = client.get(
                "/api/recommendations/user@example.com?count=5",
                headers={"x-internal-service-key": "dedicated_internal_secret_abc"},
            )
            assert res.status_code == 200
            assert "recommendations" in res.json()

    def test_direct_user_recommendations_fails_503_when_internal_key_unconfigured(self, client, mock_db):
        """Verify that personalized recommendations fail closed with 503 if INTERNAL_SERVICE_KEY is unset."""
        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", ""):
            res = client.get(
                "/api/recommendations/user@example.com?count=5",
                headers={"x-internal-service-key": "any_key"},
            )
            assert res.status_code == 503
            assert "INTERNAL_SERVICE_KEY is not configured" in res.json()["detail"]

    def test_hmac_pseudonymization_uses_dedicated_hmac_secret_independently(self):
        """Verify HMAC pseudonymization exclusively uses RECOMMENDATION_HMAC_SECRET and ignores INTERNAL_SERVICE_KEY."""
        with patch.dict(os.environ, {
            "RECOMMENDATION_HMAC_SECRET": "test_hmac_secret_999",
            "INTERNAL_SERVICE_KEY": "different_internal_key_888",
        }):
            from main import compute_pseudonymous_user_id
            import hmac
            import hashlib
            email = "TestUser@Example.COM"
            expected = hmac.new(b"test_hmac_secret_999", b"testuser@example.com", hashlib.sha256).hexdigest()
            actual = compute_pseudonymous_user_id(email)
            assert actual == expected

    def test_direct_guest_session_without_key_accepted_200(self, client, mock_db):
        """Verify anonymous guest session recommendations do NOT require internal key and return 200."""
        mock_ui_cursor = MagicMock()
        mock_ui_cursor.sort.return_value.limit.return_value = []
        mock_db.user_interactions.find.return_value = mock_ui_cursor

        sample_prod = {
            "_id": ObjectId(),
            "name": "Guest Item",
            "category": "Antiques",
            "status": "Active",
            "endTime": "2030-01-01T00:00:00Z",
        }
        mock_db.products.find.return_value.sort.return_value.limit.return_value = [sample_prod]

        with patch("main.db", mock_db):
            res = client.get("/api/recommendations?count=5&session_id=sess_direct_guest_1")
            assert res.status_code == 200
            assert "products" in res.json()

    def test_guest_session_recommendations_personalization(self, mock_db):
        """Verify anonymous guest session history personalizes recommendations by category affinity."""
        interacted_pid = ObjectId()
        # Session interaction record for anonymous guest
        mock_ui_cursor = MagicMock()
        mock_ui_cursor.sort.return_value.limit.return_value = [
            {"product_id": str(interacted_pid), "interaction_type": "click", "session_id": "sess_guest_999"}
        ]
        mock_db.user_interactions.find.return_value = mock_ui_cursor

        # Mock category lookup
        mock_db.products.find.side_effect = [
            [{"_id": interacted_pid, "category": "Watches"}],  # lookup interacted product
            MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=[
                {"_id": ObjectId(), "name": "Omega Seamaster", "category": "Watches", "status": "Active", "endTime": "2030-01-01T00:00:00Z"}
            ])))),  # category channel
            MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=[])))),  # popular channel
            MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=[])))),  # fresh channel
            MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=[])))),  # upcoming channel
        ]

        with patch("main.db", mock_db):
            recs, is_personalized = compute_recommendations("", count=5, session_id="sess_guest_999")
            assert is_personalized is True
            assert len(recs) == 1
            assert recs[0]["category"] == "Watches"

    def test_cold_start_fallback_for_new_user(self, mock_db):
        """Verify cold-start users with zero interaction history receive active catalog fallbacks."""
        # User has no history
        mock_ui_cursor = MagicMock()
        mock_ui_cursor.sort.return_value.limit.return_value = []
        mock_db.user_interactions.find.return_value = mock_ui_cursor

        # Catalog has active listings with valid time boundaries
        sample_prod = {
            "_id": ObjectId(),
            "name": "Luxury Timepiece",
            "category": "Watches",
            "status": "Active",
            "bidCount": 5,
            "endTime": "2030-01-01T00:00:00Z",
        }
        mock_prod_cursor = MagicMock()
        mock_prod_cursor.sort.return_value.limit.return_value = [sample_prod]
        mock_db.products.find.return_value = mock_prod_cursor

        with patch("main.db", mock_db):
            recs, is_personalized = compute_recommendations("newuser@example.com", count=5)
            assert len(recs) == 1
            assert recs[0]["name"] == "Luxury Timepiece"
            assert is_personalized is False

    def test_personalized_category_affinity(self, mock_db):
        """Verify user with history in category 'Watches' receives category-affinity recommendations."""
        interacted_pid = ObjectId()
        # User interaction record
        mock_db.user_interactions.find.return_value.sort.return_value.limit.return_value = [
            {"product_id": str(interacted_pid), "interaction_type": "bid", "email": "watchlover@test.com"}
        ]
        
        # Mock cursor for category products
        mock_cat_cursor = MagicMock()
        mock_cat_cursor.sort.return_value.limit.return_value = [
            {
                "_id": ObjectId(),
                "name": "Omega Seamaster",
                "category": "Watches",
                "status": "Active",
                "endTime": "2030-01-01T00:00:00Z",
            }
        ]

        # Mock cursor for fallback query
        mock_fallback_cursor = MagicMock()
        mock_fallback_cursor.sort.return_value.limit.return_value = []

        # Interacted product details
        mock_db.products.find.side_effect = [
            [{"_id": interacted_pid, "category": "Watches"}],  # lookup category
            mock_cat_cursor,  # category match query
            mock_fallback_cursor,  # fallback query
        ]

        with patch("main.db", mock_db):
            recs, is_personalized = compute_recommendations("watchlover@test.com", count=5)
            assert is_personalized is True
            assert len(recs) >= 1
            assert recs[0]["name"] == "Omega Seamaster"

    def test_count_clamping_safety(self, client, mock_db):
        """Verify count parameter is safely clamped to range [1, 50]."""
        mock_db.user_interactions.find.return_value.sort.return_value.limit.return_value = []
        mock_db.products.find.return_value.sort.return_value.limit.return_value = []

        with patch("main.db", mock_db):
            # Test requesting 100 is clamped or validated
            res_high = client.get(
                "/api/recommendations/test@example.com?count=100",
                headers={"x-internal-service-key": "test_internal_auctionx_secret_key"},
            )
            assert res_high.status_code == 422  # FastAPI validation error for le=50

            # Test valid upper bound
            res_valid = client.get(
                "/api/recommendations/test@example.com?count=50",
                headers={"x-internal-service-key": "test_internal_auctionx_secret_key"},
            )
            assert res_valid.status_code == 200

    def test_guest_recommendations_without_authentication(self, client, mock_db):
        """Verify anonymous guest requests without email return eligible recommendations with personalized=False."""
        mock_ui_cursor = MagicMock()
        mock_ui_cursor.sort.return_value.limit.return_value = []
        mock_db.user_interactions.find.return_value = mock_ui_cursor

        sample_prod = {
            "_id": ObjectId(),
            "name": "Vintage Chronograph",
            "category": "Watches",
            "status": "Active",
            "bidCount": 3,
            "endTime": "2030-01-01T00:00:00Z",
        }
        mock_prod_cursor = MagicMock()
        mock_prod_cursor.sort.return_value.limit.return_value = [sample_prod]
        mock_db.products.find.return_value = mock_prod_cursor

        with patch("main.db", mock_db), patch("main.redis_client", None):
            for path in ["/api/recommendations", "/recommendations", "/api/recommendations/guest"]:
                res = client.get(path)
                assert res.status_code == 200
                data = res.json()
                assert isinstance(data["products"], list)
                assert len(data["products"]) == 1
                assert data["products"][0]["name"] == "Vintage Chronograph"
                assert data["personalized"] is False
                assert data["cache_hit"] is False

    def test_guest_cache_isolation_from_authenticated_user(self, client, mock_db):
        """Verify guest recommendations use isolated Redis cache key (recommendations:guest:...) and do not collide with users."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None

        sample_prod = {
            "_id": ObjectId(),
            "name": "Classic Car",
            "category": "Classic & Vintage Cars",
            "status": "Active",
            "bidCount": 4,
            "endTime": "2030-01-01T00:00:00Z",
        }
        mock_prod_cursor = MagicMock()
        mock_prod_cursor.sort.return_value.limit.return_value = [sample_prod]
        mock_db.products.find.return_value = mock_prod_cursor

        with patch("main.db", mock_db), patch("main.redis_client", mock_redis):
            # 1. Guest request
            client.get("/api/recommendations?count=5")
            assert mock_redis.setex.called
            guest_cache_key = mock_redis.setex.call_args[0][0]
            assert "recommendations:guest:v1:5" in guest_cache_key

            # 2. User request
            mock_redis.reset_mock()
            mock_redis.get.return_value = None
            client.get(
                "/api/recommendations/buyer@example.com?count=5",
                headers={"x-internal-service-key": "test_internal_auctionx_secret_key"},
            )
            assert mock_redis.setex.called
            user_cache_key = mock_redis.setex.call_args[0][0]
            assert "recommendations:buyer@example.com" in user_cache_key
            assert "guest" not in user_cache_key

    def test_no_eligible_auctions_returns_empty_cleanly(self, client, mock_db):
        """Verify that when no auctions are eligible, the recommendation service returns an empty list without crashing."""
        mock_prod_cursor = MagicMock()
        mock_prod_cursor.sort.return_value.limit.return_value = []
        mock_db.products.find.return_value = mock_prod_cursor

        with patch("main.db", mock_db), patch("main.redis_client", None):
            res = client.get("/api/recommendations")
            assert res.status_code == 200
            data = res.json()
            assert data["products"] == []
            assert data["count"] == 0
            assert data["personalized"] is False


# ==============================================================================
# 4. Auction Lifecycle & Eligibility Resolution Tests
# ==============================================================================
from ranking import (
    parse_iso_or_legacy_date,
    resolve_auction_lifecycle,
    calculate_feature_scores,
    rank_and_diversify_candidates,
)
from datetime import timedelta, timezone
from collections import Counter


class TestLifecycleAndEligibility:
    def test_live_auction_resolution(self):
        now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        prod = {
            "status": "Active",
            "startTime": datetime(2026, 10, 16, 10, 0, 0, tzinfo=timezone.utc),
            "endTime": datetime(2026, 10, 16, 14, 0, 0, tzinfo=timezone.utc),
        }
        res = resolve_auction_lifecycle(prod, now=now)
        assert res["status"] == "LIVE"
        assert res["seconds_remaining"] == 7200

    def test_ended_auction_resolution(self):
        now = datetime(2026, 10, 16, 15, 0, 0, tzinfo=timezone.utc)
        prod = {
            "status": "Active",
            "endTime": datetime(2026, 10, 16, 14, 0, 0, tzinfo=timezone.utc),
        }
        res = resolve_auction_lifecycle(prod, now=now)
        assert res["status"] == "ENDED"

    def test_scheduled_future_auction_resolution(self):
        now = datetime(2026, 10, 16, 8, 0, 0, tzinfo=timezone.utc)
        prod = {
            "status": "SCHEDULED",
            "startTime": datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc),
            "endTime": datetime(2026, 10, 16, 18, 0, 0, tzinfo=timezone.utc),
        }
        res = resolve_auction_lifecycle(prod, now=now)
        assert res["status"] == "UPCOMING"
        assert res["seconds_to_start"] == 14400

    def test_moderated_and_suspended_filtering(self):
        now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        moderated_prod = {"isModerated": True, "status": "Active"}
        suspended_prod = {"moderationStatus": "SUSPENDED", "status": "Active"}
        removed_prod = {"moderationStatus": "REMOVED", "status": "Active"}

        assert resolve_auction_lifecycle(moderated_prod, now=now)["status"] == "INELIGIBLE"
        assert resolve_auction_lifecycle(suspended_prod, now=now)["status"] == "INELIGIBLE"
        assert resolve_auction_lifecycle(removed_prod, now=now)["status"] == "INELIGIBLE"

    def test_legacy_format_parsing(self):
        now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        legacy_prod = {
            "biddingStartDate": "2026-10-16T00:00:00.000Z",
            "biddingStartTime": "10:00",
            "biddingEndTime": "2026-10-16T18:00:00.000Z",
            "status": "Active",
        }
        res = resolve_auction_lifecycle(legacy_prod, now=now)
        assert res["status"] == "LIVE"
        assert res["start"] == datetime(2026, 10, 16, 10, 0, 0, tzinfo=timezone.utc)
        assert res["end"] == datetime(2026, 10, 16, 18, 0, 0, tzinfo=timezone.utc)

    def test_fail_closed_on_missing_or_malformed_end_time(self):
        """Verify auctions with missing or malformed end dates fail closed as INELIGIBLE."""
        now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)

        # Missing end time entirely
        prod_missing = {"status": "Active", "startTime": now - timedelta(hours=1)}
        res_missing = resolve_auction_lifecycle(prod_missing, now=now)
        assert res_missing["status"] == "INELIGIBLE"
        assert res_missing["reason"] == "MISSING_OR_MALFORMED_END_TIME"
        assert res_missing.get("data_quality_issue") is True

        # Malformed end time string
        prod_malformed = {"status": "Active", "endTime": "not-a-valid-date"}
        res_malformed = resolve_auction_lifecycle(prod_malformed, now=now)
        assert res_malformed["status"] == "INELIGIBLE"
        assert res_malformed["reason"] == "MISSING_OR_MALFORMED_END_TIME"
        assert res_malformed.get("data_quality_issue") is True


# ==============================================================================
# 5. Multi-Factor Scoring, Diversity & Repetition Control Tests
# ==============================================================================
class TestScoringAndDiversity:
    def test_category_diversity_cap(self):
        """Verify no single category exceeds max_per_category in primary slots."""
        now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        candidates = []
        # Create 10 items in category "Watches"
        for i in range(10):
            candidates.append({
                "_id": ObjectId(),
                "name": f"Watch {i}",
                "category": "Watches",
                "status": "Active",
                "bidCount": 10 - i,
                "endTime": now + timedelta(hours=5),
            })
        # Create 3 items in category "Cars"
        for i in range(3):
            candidates.append({
                "_id": ObjectId(),
                "name": f"Car {i}",
                "category": "Cars",
                "status": "Active",
                "bidCount": 2,
                "endTime": now + timedelta(hours=5),
            })

        recs, diag = rank_and_diversify_candidates(
            candidates=candidates,
            user_category_affinity=Counter({"Watches": 10}),
            collab_scores=Counter(),
            viewed_product_ids=set(),
            count=6,
            max_per_category=3,
            now=now,
        )

        watch_count = sum(1 for p in recs if p["category"] == "Watches")
        car_count = sum(1 for p in recs if p["category"] == "Cars")
        assert watch_count == 3
        assert car_count == 3

    def test_repetition_dampening_penalizes_viewed_items(self):
        """Verify viewed items are deprioritized by 0.4x factor compared to fresh unviewed items."""
        now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        pid_viewed = ObjectId()
        pid_fresh = ObjectId()

        candidates = [
            {
                "_id": pid_viewed,
                "name": "Viewed Item",
                "category": "Art",
                "status": "Active",
                "bidCount": 10,
                "endTime": now + timedelta(hours=5),
            },
            {
                "_id": pid_fresh,
                "name": "Fresh Item",
                "category": "Art",
                "status": "Active",
                "bidCount": 8,
                "endTime": now + timedelta(hours=5),
            },
        ]

        recs, _ = rank_and_diversify_candidates(
            candidates=candidates,
            user_category_affinity=Counter({"Art": 5}),
            collab_scores=Counter(),
            viewed_product_ids={str(pid_viewed)},
            count=2,
            now=now,
        )

        # Fresh item should rank first because viewed item score is dampened by 0.4x
        assert recs[0]["_id"] == pid_fresh
        assert recs[1]["_id"] == pid_viewed

    def test_ranking_determinism(self):
        """Verify ranking produces identical output on repeated runs with identical data."""
        now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        candidates = [
            {
                "_id": ObjectId(),
                "name": f"Item {i}",
                "category": "Art",
                "status": "Active",
                "bidCount": i,
                "endTime": now + timedelta(hours=5),
            }
            for i in range(5)
        ]

        recs1, _ = rank_and_diversify_candidates(candidates, Counter(), Counter(), set(), count=5, now=now)
        recs2, _ = rank_and_diversify_candidates(candidates, Counter(), Counter(), set(), count=5, now=now)

        ids1 = [str(p["_id"]) for p in recs1]
        ids2 = [str(p["_id"]) for p in recs2]
        assert ids1 == ids2

    def test_scores_strictly_normalized_bounded_zero_one(self):
        """Verify individual features and composite score are strictly bounded in [0.0, 1.0]."""
        now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        prod = {
            "_id": ObjectId(),
            "name": "Super Item",
            "category": "Electronics",
            "status": "Active",
            "bidCount": 1000,
            "viewCount": 50000,
            "endTime": now + timedelta(minutes=10),
            "createdAt": now,
        }
        lifecycle = resolve_auction_lifecycle(prod, now=now)
        features = calculate_feature_scores(
            product=prod,
            lifecycle=lifecycle,
            user_category_affinity=Counter({"Electronics": 500}),
            collab_scores=Counter({str(prod["_id"]): 200}),
            max_bids=1000,
            now=now,
        )
        for fname, val in features.items():
            assert 0.0 <= val <= 1.0, f"Feature {fname} = {val} out of bounds"

        recs, diag = rank_and_diversify_candidates(
            candidates=[prod],
            user_category_affinity=Counter({"Electronics": 500}),
            collab_scores=Counter({str(prod["_id"]): 200}),
            viewed_product_ids=set(),
            count=1,
            now=now,
        )
        assert len(recs) == 1

    def test_live_auction_sort_priority_without_additive_score_boost(self):
        """Verify LIVE auctions are prioritized ahead of UPCOMING auctions via stable tier sorting without corrupting score."""
        now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        live_prod = {
            "_id": ObjectId(),
            "name": "Live Item",
            "category": "Art",
            "status": "Active",
            "bidCount": 1,
            "startTime": now - timedelta(hours=1),
            "endTime": now + timedelta(hours=2),
        }
        upcoming_prod = {
            "_id": ObjectId(),
            "name": "Upcoming Item",
            "category": "Art",
            "status": "SCHEDULED",
            "bidCount": 1,
            "startTime": now + timedelta(hours=2),
            "endTime": now + timedelta(hours=6),
        }
        recs, _ = rank_and_diversify_candidates(
            candidates=[upcoming_prod, live_prod],
            user_category_affinity=Counter(),
            collab_scores=Counter(),
            viewed_product_ids=set(),
            count=2,
            now=now,
        )
        assert recs[0]["name"] == "Live Item"
        assert recs[1]["name"] == "Upcoming Item"


# ==============================================================================
# 6. Offline Evaluation Suite Tests
# ==============================================================================
from evaluation import (
    compute_precision_at_k,
    compute_recall_at_k,
    compute_ndcg_at_k,
    compute_category_diversity,
    time_aware_train_test_split,
    OfflineEvaluator,
)


class TestOfflineEvaluation:
    def test_precision_recall_ndcg_metrics(self):
        rec_ids = ["p1", "p2", "p3", "p4"]
        ground_truth = {"p1", "p3"}

        p2 = compute_precision_at_k(rec_ids, ground_truth, 2)
        p4 = compute_precision_at_k(rec_ids, ground_truth, 4)
        assert p2 == 0.5  # 1 hit out of 2
        assert p4 == 0.5  # 2 hits out of 4

        r4 = compute_recall_at_k(rec_ids, ground_truth, 4)
        assert r4 == 1.0  # both hits found

        ndcg4 = compute_ndcg_at_k(rec_ids, ground_truth, 4)
        assert 0.8 < ndcg4 <= 1.0

    def test_time_aware_split_prevents_leakage(self):
        interactions = [
            {"product_id": "p1", "timestamp": datetime(2026, 1, 1, tzinfo=timezone.utc)},
            {"product_id": "p2", "timestamp": datetime(2026, 1, 2, tzinfo=timezone.utc)},
            {"product_id": "p3", "timestamp": datetime(2026, 1, 3, tzinfo=timezone.utc)},
            {"product_id": "p4", "timestamp": datetime(2026, 1, 4, tzinfo=timezone.utc)},
        ]
        train, test = time_aware_train_test_split(interactions, train_ratio=0.5)
        assert len(train) == 2
        assert len(test) == 2
        assert train[-1]["timestamp"] < test[0]["timestamp"]

    def test_offline_evaluator_benchmark(self):
        now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        p1 = {"_id": ObjectId(), "name": "Watch A", "category": "Watches", "status": "Active", "bidCount": 10}
        p2 = {"_id": ObjectId(), "name": "Watch B", "category": "Watches", "status": "Active", "bidCount": 5}
        p3 = {"_id": ObjectId(), "name": "Book C", "category": "Books", "status": "Active", "bidCount": 20}
        catalog = [p1, p2, p3]

        interactions = [
            {"email": "eval@test.com", "product_id": str(p1["_id"]), "interaction_type": "view", "timestamp": datetime(2026, 1, 1, tzinfo=timezone.utc)},
            {"email": "eval@test.com", "product_id": str(p2["_id"]), "interaction_type": "bid", "timestamp": datetime(2026, 1, 2, tzinfo=timezone.utc)},
        ]

        evaluator = OfflineEvaluator(catalog=catalog, interactions=interactions)
        results = evaluator.evaluate_user("eval@test.com", k_values=[2])
        assert results["status"] != "SKIPPED_SPARSE_DATA" if "status" in results else True
        assert "metrics" in results


# ==============================================================================
# 7. Staging Readiness, Idempotency & Isolation Tests
# ==============================================================================
class TestStagingReadinessAndReliability:
    def test_authoritative_event_idempotency_deduplication(self, client, mock_db):
        """Verify retrying an authoritative business event with identical event_id does not create duplicate interactions."""
        valid_pid = str(ObjectId())
        mock_db.products.find_one.return_value = {
            "_id": ObjectId(valid_pid),
            "isModerated": False,
            "moderationStatus": "ACTIVE",
        }
        payload = {
            "email": "buyer@example.com",
            "product_id": valid_pid,
            "interaction_type": "bid",
            "event_id": "bid:test_order_or_bid_12345",
        }
        headers = {"x-internal-service-key": "test_internal_auctionx_secret_key"}

        # Simulate first delivery (not in db yet)
        mock_db.user_interactions.find_one.return_value = None
        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", "test_internal_auctionx_secret_key"):
            res1 = client.post("/api/track", json=payload, headers=headers)
            assert res1.status_code == 200
            assert res1.json()["tracked"] is True
            assert res1.json().get("idempotent_duplicate") is None
            mock_db.user_interactions.insert_one.assert_called_once()

        # Simulate retried delivery (event_id already in db)
        mock_db.user_interactions.reset_mock()
        mock_db.user_interactions.find_one.return_value = {
            "_id": ObjectId(),
            "event_id": "bid:test_order_or_bid_12345",
        }
        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", "test_internal_auctionx_secret_key"):
            res2 = client.post("/api/track", json=payload, headers=headers)
            assert res2.status_code == 200
            assert res2.json()["tracked"] is True
            assert res2.json().get("idempotent_duplicate") is True
            # Verify insert_one was NOT called on idempotent duplicate
            mock_db.user_interactions.insert_one.assert_not_called()

    def test_internal_service_key_missing_fails_closed_503(self, client, mock_db):
        """Verify that if INTERNAL_SERVICE_KEY is unset in non-test environment, authoritative tracking fails closed with 503."""
        valid_pid = str(ObjectId())
        payload = {
            "email": "buyer@example.com",
            "product_id": valid_pid,
            "interaction_type": "purchase",
            "event_id": "purchase:order_999",
        }
        headers = {"x-internal-service-key": "some_key"}

        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", ""):
            res = client.post("/api/track", json=payload, headers=headers)
            assert res.status_code == 503
            assert "INTERNAL_SERVICE_KEY is not configured" in res.json()["detail"]

    def test_upcoming_policy_preserves_future_listing_with_missing_end_time(self):
        """Verify scheduled listings starting in the future are recognized as UPCOMING even if end time is unpopulated."""
        now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        future_start = now + timedelta(days=1)

        # Case A: Future start time with missing end time
        prod_upcoming_missing_end = {
            "status": "Active",
            "startTime": future_start,
            "endTime": None,
        }
        res_upcoming = resolve_auction_lifecycle(prod_upcoming_missing_end, now=now)
        assert res_upcoming["status"] == "UPCOMING"
        assert res_upcoming["data_quality_warning"] == "MISSING_END_TIME"
        assert res_upcoming["seconds_to_start"] > 0

        # Case B: Past start time with missing end time -> must strictly FAIL CLOSED as INELIGIBLE
        past_start = now - timedelta(hours=2)
        prod_live_missing_end = {
            "status": "Active",
            "startTime": past_start,
            "endTime": None,
        }
        res_fail_closed = resolve_auction_lifecycle(prod_live_missing_end, now=now)
        assert res_fail_closed["status"] == "INELIGIBLE"
        assert res_fail_closed["reason"] == "MISSING_OR_MALFORMED_END_TIME"

    def test_recommended_products_contain_explicit_lifecycle_status(self):
        """Verify recommended products returned in API results are decorated with explicit lifecycleStatus."""
        now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        live_prod = {
            "_id": ObjectId(),
            "name": "Live Watch",
            "category": "Watches",
            "status": "Active",
            "startTime": now - timedelta(hours=1),
            "endTime": now + timedelta(hours=3),
        }
        upcoming_prod = {
            "_id": ObjectId(),
            "name": "Upcoming Watch",
            "category": "Watches",
            "status": "SCHEDULED",
            "startTime": now + timedelta(hours=3),
            "endTime": now + timedelta(hours=8),
        }

        recs, _ = rank_and_diversify_candidates(
            candidates=[live_prod, upcoming_prod],
            user_category_affinity=Counter(),
            collab_scores=Counter(),
            viewed_product_ids=set(),
            count=2,
            now=now,
        )
        assert len(recs) == 2
        assert recs[0]["lifecycleStatus"] == "LIVE"
        assert recs[1]["lifecycleStatus"] == "UPCOMING"

    def test_cache_multi_user_isolation(self, client, mock_db):
        """Verify User A's version token change never affects User B's cache key."""
        mock_redis = MagicMock()
        mock_redis.get.side_effect = lambda key: "5" if "alice" in key else "1"

        headers = {"x-internal-service-key": "test_internal_auctionx_secret_key"}
        with patch("main.db", mock_db), patch("main.redis_client", mock_redis):
            client.get("/api/recommendations/alice@example.com?count=10", headers=headers)
            client.get("/api/recommendations/bob@example.com?count=10", headers=headers)

            # Check that alice queried version v5 and bob queried version v1
            alice_calls = [call for call in mock_redis.get.call_args_list if "alice" in str(call)]
            bob_calls = [call for call in mock_redis.get.call_args_list if "bob" in str(call)]

            assert any("recommendations:alice@example.com:v5:10" in str(c) for c in alice_calls)
            assert any("recommendations:bob@example.com:v1:10" in str(c) for c in bob_calls)

    def test_duplicate_event_id_with_conflicting_attributes_rejected_409(self, client, mock_db):
        """Verify reusing an event_id with a different user, product, or interaction type returns 409 Conflict."""
        existing_event = {
            "email": "victim@example.com",
            "product_id": str(ObjectId()),
            "interaction_type": "bid",
            "event_id": "bid:shared_event_123",
        }
        mock_db.user_interactions.find_one.return_value = existing_event

        payload = {
            "email": "attacker@example.com",  # Different email!
            "product_id": str(ObjectId()),
            "interaction_type": "bid",
            "event_id": "bid:shared_event_123",
        }
        headers = {"x-internal-service-key": "test_internal_auctionx_secret_key"}

        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", "test_internal_auctionx_secret_key"):
            res = client.post("/api/track", json=payload, headers=headers)
            assert res.status_code == 409
            assert "Conflict: event_id 'bid:shared_event_123' was already recorded" in res.json()["detail"]

    def test_concurrent_duplicate_key_error_handled_as_idempotent_success(self, client, mock_db):
        """Verify concurrent insertion race condition hitting DuplicateKeyError on event_id returns idempotent success."""
        pid = str(ObjectId())
        event_id = f"bid:concurrent_{pid}"
        payload = {
            "email": "buyer@example.com",
            "product_id": pid,
            "interaction_type": "bid",
            "event_id": event_id,
        }
        headers = {"x-internal-service-key": "test_internal_auctionx_secret_key"}

        # Simulate read-then-write race:
        # 1. find_one during initial check returns None
        # 2. insert_one raises DuplicateKeyError for event_id index
        # 3. recovery find_one returns the concurrent matching event
        matching_event = {
            "email": "buyer@example.com",
            "product_id": pid,
            "interaction_type": "bid",
            "event_id": event_id,
        }
        product_doc = {"_id": ObjectId(pid), "isModerated": False, "moderationStatus": "ACTIVE"}

        def find_one_side_effect(query, *args, **kwargs):
            if "_id" in query:
                return product_doc
            if "event_id" in query:
                # First check returns None (racing), second check returns the inserted record
                if getattr(find_one_side_effect, "called", False):
                    return matching_event
                find_one_side_effect.called = True
                return None
            return None

        find_one_side_effect.called = False
        mock_db.user_interactions.find_one.side_effect = find_one_side_effect
        mock_db.products.find_one.return_value = product_doc

        from pymongo.errors import DuplicateKeyError
        dup_error = DuplicateKeyError("E11000 duplicate key error collection: user_interactions index: event_id_1 dup key")
        mock_db.user_interactions.insert_one.side_effect = dup_error

        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", "test_internal_auctionx_secret_key"):
            res = client.post("/api/track", json=payload, headers=headers)
            assert res.status_code == 200
            assert res.json()["idempotent_duplicate"] is True

    def test_unrelated_duplicate_key_error_returns_500(self, client, mock_db):
        """Verify duplicate key error on unrelated index returns 500 without masking error."""
        pid = str(ObjectId())
        payload = {
            "email": "buyer@example.com",
            "product_id": pid,
            "interaction_type": "view",
        }
        product_doc = {"_id": ObjectId(pid), "isModerated": False, "moderationStatus": "ACTIVE"}
        mock_db.products.find_one.return_value = product_doc
        mock_db.user_interactions.find_one.return_value = None

        from pymongo.errors import DuplicateKeyError
        unrelated_dup = DuplicateKeyError("E11000 duplicate key error collection: user_interactions index: unrelated_idx_1")
        mock_db.user_interactions.insert_one.side_effect = unrelated_dup

        with patch("main.db", mock_db):
            res = client.post("/api/track", json=payload)
            assert res.status_code == 500
            assert "Database constraint violation" in res.json()["detail"]

    def test_idempotent_duplicate_does_not_increment_cache_version(self, client, mock_db):
        """Verify idempotent duplicate event does not increment Redis cache version."""
        pid = str(ObjectId())
        event_id = f"bid:cached_{pid}"
        existing_event = {
            "email": "buyer@example.com",
            "product_id": pid,
            "interaction_type": "bid",
            "event_id": event_id,
        }
        mock_db.user_interactions.find_one.return_value = existing_event

        mock_redis = MagicMock()
        payload = {
            "email": "buyer@example.com",
            "product_id": pid,
            "interaction_type": "bid",
            "event_id": event_id,
        }
        headers = {"x-internal-service-key": "test_internal_auctionx_secret_key"}

        with patch("main.db", mock_db), patch("main.redis_client", mock_redis), patch("main.INTERNAL_SERVICE_KEY", "test_internal_auctionx_secret_key"):
            res = client.post("/api/track", json=payload, headers=headers)
            assert res.status_code == 200
            assert res.json()["idempotent_duplicate"] is True
            # Assert Redis incr was NOT called
            assert mock_redis.incr.call_count == 0


# ==============================================================================
# Phase 3: Recommendation Impressions, Telemetry Privacy, and Graded Evaluation
# ==============================================================================
class TestPhase3ImpressionPrivacyEvaluation:
    def test_pseudonymous_user_id_generation(self):
        """Verify HMAC-SHA256 user ID is deterministic, salted, and case-insensitive."""
        from main import compute_pseudonymous_user_id

        email1 = "Buyer@Example.COM"
        email2 = "buyer@example.com"
        id1 = compute_pseudonymous_user_id(email1)
        id2 = compute_pseudonymous_user_id(email2)
        assert id1 == id2
        assert len(id1) == 64
        assert all(c in "0123456789abcdef" for c in id1)

        # Verify different secret produces different pseudonym
        with patch.dict(os.environ, {"RECOMMENDATION_HMAC_SECRET": "different_secret_key"}):
            id_different = compute_pseudonymous_user_id(email1)
            assert id_different != id1

    def test_batch_impression_tracking_success(self, client, mock_db):
        """Verify batch impression tracking inserts events and does not invalidate recommendation cache."""
        from main import compute_pseudonymous_user_id

        pid1 = str(ObjectId())
        pid2 = str(ObjectId())
        mock_db.products.find_one.side_effect = lambda q, *args, **kwargs: {"_id": q["_id"], "isModerated": False, "moderationStatus": "ACTIVE"}
        mock_db.user_interactions.find_one.return_value = None

        mock_redis = MagicMock()
        payload = {
            "batch": [
                {
                    "email": "user@example.com",
                    "product_id": pid1,
                    "interaction_type": "impression",
                    "position": 0,
                    "surface": "recommendations",
                    "recommendation_id": "rec_slate_123",
                },
                {
                    "email": "user@example.com",
                    "product_id": pid2,
                    "interaction_type": "impression",
                    "position": 1,
                    "surface": "recommendations",
                    "recommendation_id": "rec_slate_123",
                },
            ]
        }

        with patch("main.db", mock_db), patch("main.redis_client", mock_redis):
            res = client.post("/api/track/batch", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["processed_count"] == 2
            assert len(data["results"]) == 2
            # Verify cache version was NOT incremented for impressions
            assert mock_redis.incr.call_count == 0
            # Verify insert_one was called with pseudonymous user_id
            assert mock_db.user_interactions.insert_one.call_count == 2
            inserted_doc = mock_db.user_interactions.insert_one.call_args_list[0][0][0]
            assert inserted_doc["user_id"] == compute_pseudonymous_user_id("user@example.com")
            assert inserted_doc["position"] == 0
            assert inserted_doc["surface"] == "recommendations"

    def test_batch_tracking_rejects_authoritative_events(self, client, mock_db):
        """Verify client-facing batch tracking endpoint rejects unauthenticated bid/purchase events."""
        payload = {
            "batch": [
                {
                    "email": "user@example.com",
                    "product_id": str(ObjectId()),
                    "interaction_type": "bid",
                }
            ]
        }
        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", "test_internal_auctionx_secret_key"):
            res = client.post("/api/track/batch", json=payload)
            assert res.status_code == 403
            assert "requires valid internal service credentials" in res.json()["detail"]

    def test_impression_deduplication_window(self, client, mock_db):
        """Verify repeated impression callbacks within 5-minute window are deduplicated without DB insert."""
        pid = str(ObjectId())
        mock_db.products.find_one.return_value = {"_id": ObjectId(pid), "isModerated": False, "moderationStatus": "ACTIVE"}
        from datetime import timezone

        now_utc = datetime.now(timezone.utc)
        # Simulate existing impression in DB
        mock_db.user_interactions.find_one.return_value = {
            "email": "user@example.com",
            "product_id": pid,
            "interaction_type": "impression",
            "timestamp": now_utc,
        }

        payload = {
            "email": "user@example.com",
            "product_id": pid,
            "interaction_type": "impression",
        }

        with patch("main.db", mock_db):
            res = client.post("/api/track", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data["duplicate"] is True
            assert mock_db.user_interactions.insert_one.call_count == 0

    def test_graded_ndcg_at_k_calculation(self):
        """Verify graded NDCG calculation awards higher rank to higher-tier interactions."""
        from evaluation import compute_graded_ndcg_at_k

        p_purchased = "prod_purchase"
        p_viewed = "prod_view"
        ground_truth = {
            p_purchased: 10.0,
            p_viewed: 1.0,
        }

        # Optimal ranking: [purchased, viewed] -> NDCG = 1.0
        optimal_recs = [p_purchased, p_viewed]
        ndcg_optimal = compute_graded_ndcg_at_k(optimal_recs, ground_truth, k=2)
        assert ndcg_optimal == 1.0

        # Suboptimal ranking: [viewed, purchased] -> NDCG < 1.0
        suboptimal_recs = [p_viewed, p_purchased]
        ndcg_suboptimal = compute_graded_ndcg_at_k(suboptimal_recs, ground_truth, k=2)
        assert 0.0 < ndcg_suboptimal < 1.0
        assert ndcg_optimal > ndcg_suboptimal

        # Unobserved recommendations return 0.0 gain without errors
        unobserved_recs = ["prod_other1", "prod_other2"]
        assert compute_graded_ndcg_at_k(unobserved_recs, ground_truth, k=2) == 0.0

    def test_offline_evaluator_graded_metrics_and_temporal_leakage(self):
        """Verify OfflineEvaluator preserves temporal train/test split, handles duplicates, and computes ndcg_graded."""
        from evaluation import OfflineEvaluator
        from datetime import timedelta

        now = datetime(2026, 10, 16, 12, 0, 0)
        p1 = str(ObjectId())
        p2 = str(ObjectId())
        p3 = str(ObjectId())

        catalog = [
            {"_id": ObjectId(p1), "name": "Prod 1", "category": "Art", "bidCount": 10, "status": "Active", "biddingStartDate": now - timedelta(days=1), "biddingEndTime": now + timedelta(days=5)},
            {"_id": ObjectId(p2), "name": "Prod 2", "category": "Collectibles", "bidCount": 5, "status": "Active", "biddingStartDate": now - timedelta(days=1), "biddingEndTime": now + timedelta(days=5)},
            {"_id": ObjectId(p3), "name": "Prod 3", "category": "Jewelry", "bidCount": 1, "status": "Active", "biddingStartDate": now - timedelta(days=1), "biddingEndTime": now + timedelta(days=5)},
        ]

        interactions = [
            # Training interactions (chronologically earlier)
            {"email": "user@example.com", "product_id": p1, "interaction_type": "view", "timestamp": now - timedelta(hours=5)},
            {"email": "user@example.com", "product_id": p1, "interaction_type": "click", "timestamp": now - timedelta(hours=4)},
            {"email": "user@example.com", "product_id": p2, "interaction_type": "view", "timestamp": now - timedelta(hours=3)},
            # Test interactions (chronologically later, with duplicate events for p2)
            {"email": "user@example.com", "product_id": p2, "interaction_type": "view", "timestamp": now - timedelta(hours=2)},
            {"email": "user@example.com", "product_id": p2, "interaction_type": "purchase", "timestamp": now - timedelta(hours=1)},
        ]

        evaluator = OfflineEvaluator(catalog=catalog, interactions=interactions)
        results = evaluator.evaluate_user("user@example.com", k_values=[2])

        assert results["user"] == "user@example.com"
        assert results["train_interactions_count"] == 3
        assert results["test_interactions_count"] == 2
        assert results["is_statistically_sparse"] is True
        assert results["sparsity_warning"] is not None

        # Verify metrics structure includes both ndcg_binary and ndcg_graded
        metrics_k2 = results["metrics"]["K=2"]["hybrid"]
        assert "ndcg_binary" in metrics_k2
        assert "ndcg_graded" in metrics_k2
        assert "ndcg" in metrics_k2  # Backwards compatibility


# ==============================================================================
# 9. Redis Client Configuration & URL Parsing Hardening Tests (Phase 1)
# ==============================================================================
class TestRedisClientConfiguration:
    def test_unauthenticated_url_parsing(self):
        """Verify unauthenticated URL correctly sets host, port, db, decode_responses, and timeout."""
        client = build_redis_client("redis://localhost:6379/0")
        kwargs = client.connection_pool.connection_kwargs
        assert kwargs["host"] == "localhost"
        assert kwargs["port"] == 6379
        assert kwargs["db"] == 0
        assert kwargs["decode_responses"] is True
        assert kwargs["socket_connect_timeout"] == 5
        assert kwargs.get("password") is None
        assert kwargs.get("username") is None

    def test_password_authenticated_url(self):
        """Verify password-authenticated Redis URL correctly configures credentials."""
        client = build_redis_client("redis://:test_secret_pass@localhost:6379/1")
        kwargs = client.connection_pool.connection_kwargs
        assert kwargs["host"] == "localhost"
        assert kwargs["port"] == 6379
        assert kwargs["db"] == 1
        assert kwargs["password"] == "test_secret_pass"
        assert kwargs["decode_responses"] is True
        assert kwargs["socket_connect_timeout"] == 5

    def test_username_and_password_url(self):
        """Verify Redis ACL username and password URL configures both fields."""
        client = build_redis_client("redis://testuser:test_secret_pass@127.0.0.1:6379/2")
        kwargs = client.connection_pool.connection_kwargs
        assert kwargs["host"] == "127.0.0.1"
        assert kwargs["port"] == 6379
        assert kwargs["db"] == 2
        assert kwargs["username"] == "testuser"
        assert kwargs["password"] == "test_secret_pass"

    def test_url_encoded_credentials(self):
        """Verify percent-encoded characters in username and password are correctly decoded."""
        client = build_redis_client("redis://user%40example.com:p%40ss%3Aword%21@localhost:6379/3")
        kwargs = client.connection_pool.connection_kwargs
        assert kwargs["username"] == "user@example.com"
        assert kwargs["password"] == "p@ss:word!"
        assert kwargs["db"] == 3

    def test_rediss_tls_url_handling(self):
        """Verify rediss:// scheme configures SSLConnection class and TLS support."""
        import redis.connection

        client = build_redis_client("rediss://:test_ssl_pass@cache.example.com:6380/4")
        assert issubclass(client.connection_pool.connection_class, redis.connection.SSLConnection)
        kwargs = client.connection_pool.connection_kwargs
        assert kwargs["host"] == "cache.example.com"
        assert kwargs["port"] == 6380
        assert kwargs["db"] == 4
        assert kwargs["password"] == "test_ssl_pass"

    def test_database_index_parsing(self):
        """Verify custom database index path is respected."""
        for db_idx in [0, 5, 14]:
            client = build_redis_client(f"redis://127.0.0.1:6379/{db_idx}")
            assert client.connection_pool.connection_kwargs["db"] == db_idx

    def test_connection_failure_fallback_in_lifespan(self, capsys):
        """Verify lifespan gracefully handles Redis connection error and falls back to running without cache."""
        import asyncio
        import main

        mock_client = MagicMock()
        mock_client.ping.side_effect = Exception("Connection refused by test mock")

        with patch("main.build_redis_client", return_value=mock_client), \
             patch.dict(os.environ, {"REDIS_URL": "redis://:secret_test_pass@127.0.0.1:6379/0"}), \
             patch("main.mongo_client") as mock_mongo:
            mock_mongo.admin.command.return_value = {"ok": 1}

            async def run_lifespan():
                async with main.lifespan(main.app):
                    assert main.redis_client is None

            asyncio.run(run_lifespan())

            captured = capsys.readouterr().out
            assert "Redis unavailable, running without cache" in captured
            assert "Connection refused by test mock" in captured
            # Ensure the test password is never leaked into logs
            assert "secret_test_pass" not in captured

    def test_no_redis_url_behavior(self, capsys):
        """Verify lifespan handles missing REDIS_URL cleanly without attempting connection."""
        import asyncio
        import main

        with patch.dict(os.environ, {}, clear=True), \
             patch("main.mongo_client") as mock_mongo:
            mock_mongo.admin.command.return_value = {"ok": 1}

            async def run_lifespan():
                async with main.lifespan(main.app):
                    assert main.redis_client is None

            asyncio.run(run_lifespan())

            captured = capsys.readouterr().out
            assert "No REDIS_URL configured, running without cache" in captured
