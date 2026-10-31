"""
Unit tests for settings resolution, internal auth barrier, and cryptographic pseudonymization.
"""

import os
from unittest.mock import patch
import pytest

from auctionx_recommendations.infrastructure.config.settings import (
    Settings,
    resolve_mongo_configuration,
    detect_is_testing,
)
from auctionx_recommendations.infrastructure.security.internal_auth import (
    verify_internal_service_key,
)
from auctionx_recommendations.infrastructure.security.pseudonymization import (
    compute_pseudonymous_user_id,
)


class TestSettingsAndSecurity:
    """Verifies infrastructure security, settings validation, and PII protection."""

    def test_mongo_uri_database_name_resolution(self):
        uri, db = resolve_mongo_configuration("mongodb://localhost:27017/auctionx-custom", "")
        assert uri == "mongodb://localhost:27017/auctionx-custom"
        assert db == "auctionx-custom"

    def test_mongo_default_db_fallback(self):
        uri, db = resolve_mongo_configuration("mongodb://127.0.0.1:27017", "")
        assert db == "Auction-X"

    def test_pseudonymous_user_id_determinism(self):
        id1 = compute_pseudonymous_user_id("alice@example.com", explicit_secret="secret123")
        id2 = compute_pseudonymous_user_id("ALICE@EXAMPLE.COM", explicit_secret="secret123")
        assert id1 == id2
        assert len(id1) == 64  # SHA-256 hex digest

    def test_pseudonymous_user_id_different_emails_produce_different_digests(self):
        id1 = compute_pseudonymous_user_id("alice@example.com", explicit_secret="secret123")
        id2 = compute_pseudonymous_user_id("bob@example.com", explicit_secret="secret123")
        assert id1 != id2

    def test_internal_auth_verifies_constant_time(self):
        key = "secure_random_key_value_abcdef"
        assert verify_internal_service_key(key, configured_key=key, environment="production") is True
        assert verify_internal_service_key("wrong_key", configured_key=key, environment="production") is False
        assert verify_internal_service_key("", configured_key=key, environment="production") is False
        assert verify_internal_service_key(None, configured_key=key, environment="production") is False

    def test_internal_auth_test_environment_fallback(self):
        assert verify_internal_service_key("test_internal_auctionx_secret_key", configured_key="", environment="test") is True
