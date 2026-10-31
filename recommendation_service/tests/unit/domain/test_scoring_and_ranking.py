"""
Unit tests for scoring calculations, repetition dampening, and diversity ranking engine.
"""

from collections import Counter
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import pytest

from auctionx_recommendations.domain.ranking.features import (
    DEFAULT_RANKING_WEIGHTS,
    INTERACTION_WEIGHTS,
)
from auctionx_recommendations.domain.ranking.scoring import calculate_feature_scores
from auctionx_recommendations.domain.ranking.engine import rank_and_diversify_candidates


class TestScoringAndRankingDomain:
    """Verifies normalized scoring, feature weights, repetition dampening, and diversity capping."""

    def test_ranking_weights_sum_to_one(self):
        total = sum(DEFAULT_RANKING_WEIGHTS.values())
        assert abs(total - 1.0) < 1e-6

    def test_interaction_weights_hierarchy(self):
        assert INTERACTION_WEIGHTS["purchase"] > INTERACTION_WEIGHTS["bid"]
        assert INTERACTION_WEIGHTS["bid"] > INTERACTION_WEIGHTS["click"]
        assert INTERACTION_WEIGHTS["click"] > INTERACTION_WEIGHTS["view"]
        assert INTERACTION_WEIGHTS["impression"] == 0.0

    def test_normalized_scores_bounded_zero_to_one(self):
        now = datetime.now(timezone.utc)
        prod = {
            "_id": str(ObjectId()),
            "category": "Art",
            "bidCount": 45,
            "viewCount": 200,
            "createdAt": (now - timedelta(days=2)).isoformat(),
        }
        lifecycle = {
            "status": "LIVE",
            "seconds_remaining": 3600 * 2,  # 2 hours left
        }
        scores = calculate_feature_scores(
            product=prod,
            lifecycle=lifecycle,
            user_category_affinity=Counter({"Art": 10.0, "Watches": 2.0}),
            collab_scores=Counter({prod["_id"]: 5.0}),
            max_bids=50,
            now=now,
        )

        for feature_name, score in scores.items():
            assert 0.0 <= score <= 1.0, f"Score for {feature_name} out of bounds: {score}"

    def test_repetition_dampening_penalizes_viewed_items(self):
        now = datetime.now(timezone.utc)
        end_time = (now + timedelta(days=1)).isoformat()
        p1_id = str(ObjectId())
        p2_id = str(ObjectId())

        # Two identical items, but p1 has already been viewed by the user
        candidates = [
            {"_id": p1_id, "name": "Item A", "category": "Tech", "bidCount": 10, "status": "Active", "endTime": end_time},
            {"_id": p2_id, "name": "Item B", "category": "Tech", "bidCount": 10, "status": "Active", "endTime": end_time},
        ]

        ranked, diag = rank_and_diversify_candidates(
            candidates=candidates,
            user_category_affinity=Counter({"Tech": 5.0}),
            collab_scores=Counter(),
            viewed_product_ids={p1_id},
            count=2,
            now=now,
        )

        # Unviewed Item B must rank first ahead of dampened Item A
        assert ranked[0]["_id"] == p2_id
        assert ranked[1]["_id"] == p1_id
        assert diag["repetition_dampened_count"] == 1

    def test_category_diversity_slot_capping(self):
        now = datetime.now(timezone.utc)
        end_time = (now + timedelta(days=1)).isoformat()

        # 5 items from "Watches" and 2 items from "Art"
        candidates = []
        for i in range(5):
            candidates.append({
                "_id": str(ObjectId()),
                "name": f"Watch {i}",
                "category": "Watches",
                "bidCount": 20 - i,
                "status": "Active",
                "endTime": end_time,
            })
        for i in range(2):
            candidates.append({
                "_id": str(ObjectId()),
                "name": f"Painting {i}",
                "category": "Art",
                "bidCount": 5 - i,
                "status": "Active",
                "endTime": end_time,
            })

        # Request top 5 with max_per_category=3
        ranked, diag = rank_and_diversify_candidates(
            candidates=candidates,
            user_category_affinity=Counter({"Watches": 10.0}),
            collab_scores=Counter(),
            viewed_product_ids=set(),
            count=5,
            max_per_category=3,
            now=now,
        )

        watch_count = sum(1 for p in ranked[:4] if p["category"] == "Watches")
        assert watch_count <= 3, "Primary slots must cap single category at 3"
        assert any(p["category"] == "Art" for p in ranked), "Diverse category must be surfaced"

    def test_ranking_determinism(self):
        now = datetime.now(timezone.utc)
        end_time = (now + timedelta(days=1)).isoformat()
        candidates = [
            {"_id": "prod_a", "name": "A", "category": "C1", "bidCount": 5, "status": "Active", "endTime": end_time},
            {"_id": "prod_b", "name": "B", "category": "C2", "bidCount": 5, "status": "Active", "endTime": end_time},
            {"_id": "prod_c", "name": "C", "category": "C1", "bidCount": 10, "status": "Active", "endTime": end_time},
        ]
        res1, _ = rank_and_diversify_candidates(candidates, Counter(), Counter(), set(), count=3, now=now)
        res2, _ = rank_and_diversify_candidates(candidates, Counter(), Counter(), set(), count=3, now=now)

        assert [p["_id"] for p in res1] == [p["_id"] for p in res2]
