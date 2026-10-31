"""
Regression Tests for Recommendation Service CORS Policy & Lifecycle
Supports isolated in-process testing via FastAPI TestClient (default)
with synthetic database mocks, preventing live database contamination.
"""
import os
import sys
import json
import unittest
from unittest.mock import MagicMock

# Ensure recommendation_service root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
import main
from main import app

SYNTHETIC_PRODUCT_ID = "6acbe26b0823644a28f38fc7"


class TestRecommendationServiceCORS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Configure fully isolated synthetic mocks for database
        cls.mock_db = MagicMock()
        cls.mock_db.products.find_one.return_value = {
            "_id": SYNTHETIC_PRODUCT_ID,
            "name": "Synthetic Test Item",
            "isModerated": False,
            "moderationStatus": "ACTIVE",
            "startingPrice": 100,
            "currentPrice": 150,
        }
        cls.mock_db.user_interactions.find_one.return_value = None
        cls.mock_db.user_interactions.insert_one.return_value = MagicMock(inserted_id="mock_interaction_1")
        cls.mock_db.name = "auctionx-test-synthetic"

        # Apply synthetic mock to recommendation service handle
        cls.original_db = main.db
        main.db = cls.mock_db

        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        # Restore original database handle
        main.db = cls.original_db

    def test_allowed_origin_get_recommendations(self):
        """Verify GET /api/recommendations succeeds with Access-Control-Allow-Origin for allowed origin."""
        response = self.client.get(
            "/api/recommendations?count=4",
            headers={"Origin": "http://localhost:3000"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:3000")
        data = response.json()
        self.assertIn("products", data)

    def test_allowed_origin_options_preflight(self):
        """Verify OPTIONS preflight request from allowed origin returns 200 and allowed methods."""
        response = self.client.options(
            "/api/recommendations?count=4",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Content-Type",
            }
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:3000")
        allowed_methods = response.headers.get("access-control-allow-methods", "")
        self.assertIn("GET", allowed_methods)
        self.assertIn("POST", allowed_methods)

    def test_disallowed_origin_rejected(self):
        """Verify preflight request from disallowed origin is rejected with 400 Bad Request."""
        response = self.client.options(
            "/api/recommendations?count=4",
            headers={
                "Origin": "http://malicious-site.example.com",
                "Access-Control-Request-Method": "GET"
            }
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Disallowed CORS origin", response.text)
        self.assertIsNone(response.headers.get("access-control-allow-origin"))

    def test_post_track_with_allowed_origin(self):
        """Verify POST /api/track with synthetic payload succeeds and returns CORS headers without DB writes."""
        payload = {
            "email": "test_user@example.com",
            "product_id": SYNTHETIC_PRODUCT_ID,
            "interaction_type": "view"
        }
        response = self.client.post(
            "/api/track",
            json=payload,
            headers={"Origin": "http://localhost:3000"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:3000")
        data = response.json()
        self.assertEqual(data.get("status"), "success")
        self.assertTrue(data.get("tracked"))

    def test_disallowed_origin_post_track_preflight(self):
        """Verify preflight for POST /api/track from disallowed origin is rejected."""
        response = self.client.options(
            "/api/track",
            headers={
                "Origin": "http://malicious-site.example.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Disallowed CORS origin", response.text)
        self.assertIsNone(response.headers.get("access-control-allow-origin"))


if __name__ == "__main__":
    unittest.main()
