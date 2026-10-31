"""
AuctionX — Recommendation Quality & Offline Evaluation Suite.
Backward-compatibility facade delegating to auctionx_recommendations.evaluation.
"""

import os
import sys

# Ensure src/ is on sys.path for direct imports
_SRC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
if _SRC_DIR not in sys.path:
    sys.path.insert(0, _SRC_DIR)

from auctionx_recommendations.evaluation.offline_evaluation import (
    DEFAULT_GRADED_RELEVANCE_WEIGHTS,
    OfflineEvaluator,
    compute_category_diversity,
    compute_graded_ndcg_at_k,
    compute_ndcg_at_k,
    compute_precision_at_k,
    compute_recall_at_k,
    time_aware_train_test_split,
)

__all__ = [
    "DEFAULT_GRADED_RELEVANCE_WEIGHTS",
    "OfflineEvaluator",
    "compute_category_diversity",
    "compute_graded_ndcg_at_k",
    "compute_ndcg_at_k",
    "compute_precision_at_k",
    "compute_recall_at_k",
    "time_aware_train_test_split",
]
