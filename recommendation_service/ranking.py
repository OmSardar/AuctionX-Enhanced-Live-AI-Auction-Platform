"""
AuctionX — Core Recommendation & Ranking Engine (v2.0)
Backward-compatibility facade delegating to auctionx_recommendations.domain.
"""

import os
import sys

# Ensure src/ is on sys.path for direct imports
_SRC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
if _SRC_DIR not in sys.path:
    sys.path.insert(0, _SRC_DIR)

from auctionx_recommendations.domain.ranking.features import (
    DEFAULT_RANKING_WEIGHTS,
    INTERACTION_WEIGHTS,
)
from auctionx_recommendations.domain.policies.auction_eligibility import (
    parse_iso_or_legacy_date,
    resolve_auction_lifecycle,
)
from auctionx_recommendations.domain.ranking.scoring import calculate_feature_scores
from auctionx_recommendations.domain.ranking.engine import rank_and_diversify_candidates

__all__ = [
    "DEFAULT_RANKING_WEIGHTS",
    "INTERACTION_WEIGHTS",
    "parse_iso_or_legacy_date",
    "resolve_auction_lifecycle",
    "calculate_feature_scores",
    "rank_and_diversify_candidates",
]
