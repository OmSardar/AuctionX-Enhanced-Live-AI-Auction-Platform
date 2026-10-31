"""
Unit tests for domain auction eligibility and lifecycle resolution.
"""

from datetime import datetime, timedelta, timezone
import pytest
from auctionx_recommendations.domain.policies.auction_eligibility import (
    parse_iso_or_legacy_date,
    resolve_auction_lifecycle,
)


class TestAuctionEligibilityPolicies:
    """Tests the domain eligibility policies under modern, legacy, and boundary conditions."""

    def test_parse_iso_date_utc(self):
        dt = parse_iso_or_legacy_date("2026-06-15T10:00:00Z")
        assert dt is not None
        assert dt.tzinfo == timezone.utc
        assert dt.year == 2026
        assert dt.month == 6
        assert dt.day == 15

    def test_parse_legacy_date_and_time_strings(self):
        dt = parse_iso_or_legacy_date("2026-08-20", "14:30")
        assert dt is not None
        assert dt.year == 2026
        assert dt.hour == 14
        assert dt.minute == 30

    def test_parse_malformed_date_returns_none(self):
        assert parse_iso_or_legacy_date("not-a-date") is None
        assert parse_iso_or_legacy_date(None, None) is None

    def test_moderated_product_is_ineligible(self):
        prod = {
            "name": "Moderated Watch",
            "isModerated": True,
            "status": "Active",
            "endTime": "2030-01-01T00:00:00Z",
        }
        res = resolve_auction_lifecycle(prod)
        assert res["status"] == "INELIGIBLE"
        assert res["reason"] == "MODERATED"

    def test_suspended_or_removed_status_is_ineligible(self):
        for status in ["REMOVED", "SUSPENDED", "FLAGGED"]:
            prod = {
                "name": "Suspended Item",
                "moderationStatus": status,
                "status": "Active",
                "endTime": "2030-01-01T00:00:00Z",
            }
            res = resolve_auction_lifecycle(prod)
            assert res["status"] == "INELIGIBLE"
            assert "MODERATION" in res["reason"]

    def test_live_auction_resolution(self):
        now = datetime.now(timezone.utc)
        start = (now - timedelta(hours=2)).isoformat()
        end = (now + timedelta(hours=5)).isoformat()
        prod = {
            "name": "Live Painting",
            "status": "Active",
            "startTime": start,
            "endTime": end,
        }
        res = resolve_auction_lifecycle(prod, now=now)
        assert res["status"] == "LIVE"
        assert res["seconds_remaining"] > 0

    def test_upcoming_auction_resolution(self):
        now = datetime.now(timezone.utc)
        start = (now + timedelta(hours=10)).isoformat()
        end = (now + timedelta(hours=20)).isoformat()
        prod = {
            "name": "Future Rare Coin",
            "status": "Active",
            "startTime": start,
            "endTime": end,
        }
        res = resolve_auction_lifecycle(prod, now=now)
        assert res["status"] == "UPCOMING"
        assert res["seconds_to_start"] > 0

    def test_ended_auction_past_end_time(self):
        now = datetime.now(timezone.utc)
        start = (now - timedelta(days=2)).isoformat()
        end = (now - timedelta(hours=1)).isoformat()
        prod = {
            "name": "Ended Antique",
            "status": "Active",
            "startTime": start,
            "endTime": end,
        }
        res = resolve_auction_lifecycle(prod, now=now)
        assert res["status"] == "ENDED"
        assert res["reason"] == "PAST_END_TIME"

    def test_missing_end_time_fails_closed_for_live_candidates(self):
        now = datetime.now(timezone.utc)
        prod = {
            "name": "Zombie Candidate",
            "status": "Active",
            "startTime": (now - timedelta(hours=1)).isoformat(),
            # No endTime!
        }
        res = resolve_auction_lifecycle(prod, now=now)
        assert res["status"] == "INELIGIBLE"
        assert res["reason"] == "MISSING_OR_MALFORMED_END_TIME"
        assert res["data_quality_issue"] is True
