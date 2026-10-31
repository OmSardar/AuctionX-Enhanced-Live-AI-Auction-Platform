"""
Contract tests verifying API contracts and backend proxy compatibility.
"""

from unittest.mock import MagicMock, patch
from bson import ObjectId
from fastapi.testclient import TestClient
import pytest

from main import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.name = "Auction-X"
    db.products = MagicMock()
    db.user_interactions = MagicMock()
    db.user_interactions.find_one.return_value = None
    return db


class TestBackendAPIContracts:
    """Verifies that all API contracts match the expectations of the AuctionX Express backend."""

    def test_guest_recommendations_response_schema(self, client, mock_db):
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value.limit.return_value = []
        mock_db.products.find.return_value = mock_cursor

        with patch("main.db", mock_db):
            res = client.get("/api/recommendations?count=5")
            assert res.status_code == 200
            data = res.json()

            # Contract verification
            assert "recommendation_id" in data
            assert "products" in data
            assert "recommendations" in data
            assert "count" in data
            assert "cache_hit" in data
            assert "personalized" in data
            assert isinstance(data["products"], list)
            assert data["personalized"] is False

    def test_direct_user_recommendations_requires_internal_key_403(self, client, mock_db):
        with patch("main.db", mock_db):
            res = client.get("/api/recommendations/alice@example.com?count=5")
            assert res.status_code == 403
            assert "Personalized user recommendations require trusted internal service authorization" in res.json()["detail"]

    def test_direct_user_recommendations_with_internal_key_succeeds(self, client, mock_db):
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value.limit.return_value = []
        mock_db.products.find.return_value = mock_cursor
        mock_db.user_interactions.find.return_value = mock_cursor

        headers = {"x-internal-service-key": "test_internal_auctionx_secret_key"}
        with patch("main.db", mock_db), patch("main.INTERNAL_SERVICE_KEY", "test_internal_auctionx_secret_key"):
            res = client.get("/api/recommendations/alice@example.com?count=5", headers=headers)
            assert res.status_code == 200
            data = res.json()
            assert "recommendation_id" in data
            assert "products" in data

    def test_batch_interaction_response_contract(self, client, mock_db):
        pid = str(ObjectId())
        mock_db.products.find_one.return_value = {"_id": ObjectId(pid), "isModerated": False, "moderationStatus": "ACTIVE"}
        mock_db.user_interactions.find_one.return_value = None

        payload = {
            "interactions": [
                {"email": "buyer@example.com", "product_id": pid, "interaction_type": "view"}
            ]
        }
        with patch("main.db", mock_db):
            res = client.post("/api/track/batch", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "success"
            assert data["processed_count"] == 1
            assert isinstance(data["results"], list)
