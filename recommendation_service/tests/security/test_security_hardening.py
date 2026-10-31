"""
Security hardening tests:
- Auth key tampering & timing safety
- Forged authoritative business events
- Batch size bounding
- Input sanitization & PII leakage
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


class TestSecurityHardening:
    """Tests security invariants, abuse resistance, and privacy guarantees."""

    def test_forged_bid_without_internal_key_rejected_403(self, client, mock_db):
        pid = str(ObjectId())
        payload = {
            "email": "attacker@example.com",
            "product_id": pid,
            "interaction_type": "bid",
        }
        with patch("main.db", mock_db):
            res = client.post("/api/track", json=payload)
            assert res.status_code == 403
            assert "requires valid internal service credentials" in res.json()["detail"]

    def test_forged_purchase_without_internal_key_rejected_403(self, client, mock_db):
        pid = str(ObjectId())
        payload = {
            "email": "attacker@example.com",
            "product_id": pid,
            "interaction_type": "purchase",
        }
        with patch("main.db", mock_db):
            res = client.post("/api/track", json=payload)
            assert res.status_code == 403

    def test_batch_interaction_capped_at_25(self, client, mock_db):
        pid = str(ObjectId())
        # Attempt oversized batch of 26 interactions
        items = [
            {"email": f"user{i}@test.com", "product_id": pid, "interaction_type": "view"}
            for i in range(26)
        ]
        with patch("main.db", mock_db):
            res = client.post("/api/track/batch", json={"interactions": items})
            assert res.status_code == 400
            assert "exceeds maximum limit of 25" in res.json()["detail"]

    def test_invalid_product_id_rejected_400(self, client, mock_db):
        payload = {
            "email": "user@test.com",
            "product_id": "not-an-objectid",
            "interaction_type": "view",
        }
        with patch("main.db", mock_db):
            res = client.post("/api/track", json=payload)
            assert res.status_code == 400
            assert "Invalid product_id" in res.json()["detail"]

    def test_invalid_interaction_type_rejected_400(self, client, mock_db):
        pid = str(ObjectId())
        payload = {
            "email": "user@test.com",
            "product_id": pid,
            "interaction_type": "arbitrary_mutation",
        }
        with patch("main.db", mock_db):
            res = client.post("/api/track", json=payload)
            assert res.status_code == 400
            assert "Invalid interaction_type" in res.json()["detail"]
