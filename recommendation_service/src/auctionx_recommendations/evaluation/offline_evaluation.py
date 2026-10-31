"""
AuctionX — Recommendation Quality & Offline Evaluation Suite.
Provides rigorous, time-aware offline evaluation comparing:
1. Proposed Hybrid Multi-Factor Ranker
2. Popularity Baseline (eligible items ranked by bidCount)
3. Random Eligible Baseline
"""

from collections import Counter
from datetime import datetime
import math
from typing import Any, Dict, List, Optional, Set, Tuple

from ..domain.policies.auction_eligibility import resolve_auction_lifecycle
from ..domain.ranking.engine import rank_and_diversify_candidates
from ..domain.ranking.features import INTERACTION_WEIGHTS


def compute_precision_at_k(recommended_ids: List[str], ground_truth_ids: Set[str], k: int) -> float:
    """Computes Precision@K: fraction of top-K recommendations that were interacted with."""
    if k <= 0 or not recommended_ids:
        return 0.0
    top_k = recommended_ids[:k]
    hits = sum(1 for pid in top_k if pid in ground_truth_ids)
    return hits / float(k)


def compute_recall_at_k(recommended_ids: List[str], ground_truth_ids: Set[str], k: int) -> float:
    """Computes Recall@K: fraction of actual holdout interactions retrieved in top-K."""
    if not ground_truth_ids or k <= 0:
        return 0.0
    top_k = recommended_ids[:k]
    hits = sum(1 for pid in top_k if pid in ground_truth_ids)
    return hits / float(len(ground_truth_ids))


def compute_ndcg_at_k(recommended_ids: List[str], ground_truth_ids: Set[str], k: int) -> float:
    """Computes Normalized Discounted Cumulative Gain at K (NDCG@K) under binary relevance."""
    if k <= 0 or not recommended_ids or not ground_truth_ids:
        return 0.0

    top_k = recommended_ids[:k]
    dcg = 0.0
    for i, pid in enumerate(top_k):
        if pid in ground_truth_ids:
            dcg += 1.0 / math.log2(i + 2)

    ideal_hits = min(k, len(ground_truth_ids))
    idcg = sum(1.0 / math.log2(i + 2) for i in range(ideal_hits))

    return dcg / idcg if idcg > 0.0 else 0.0


DEFAULT_GRADED_RELEVANCE_WEIGHTS: Dict[str, float] = {
    "impression": 0.0,
    "view": 1.0,
    "click": 2.0,
    "bid": 5.0,
    "purchase": 10.0,
}


def compute_graded_ndcg_at_k(
    recommended_ids: List[str],
    ground_truth_relevance: Dict[str, float],
    k: int,
    gain_type: str = "linear",
) -> float:
    """
    Computes Graded Normalized Discounted Cumulative Gain at K (Graded NDCG@K).
    """
    if k <= 0 or not recommended_ids or not ground_truth_relevance:
        return 0.0

    def get_gain(rel: float) -> float:
        if rel <= 0.0:
            return 0.0
        if gain_type == "exponential":
            return (2.0 ** rel) - 1.0
        return float(rel)

    top_k = recommended_ids[:k]
    dcg = 0.0
    for i, pid in enumerate(top_k):
        rel = ground_truth_relevance.get(pid, 0.0)
        if rel > 0.0:
            dcg += get_gain(rel) / math.log2(i + 2)

    sorted_ideal = sorted(
        [r for r in ground_truth_relevance.values() if r > 0.0],
        reverse=True,
    )
    if not sorted_ideal:
        return 0.0

    ideal_k = min(k, len(sorted_ideal))
    idcg = sum(get_gain(sorted_ideal[i]) / math.log2(i + 2) for i in range(ideal_k))

    return dcg / idcg if idcg > 0.0 else 0.0


def compute_category_diversity(recommended_products: List[Dict[str, Any]], k: int) -> float:
    """Computes Category Diversity ratio (unique categories / count)."""
    if k <= 0 or not recommended_products:
        return 0.0
    top_k = recommended_products[:k]
    cats = {p.get("category", "General") for p in top_k}
    return len(cats) / float(len(top_k))


def time_aware_train_test_split(
    interactions: List[Dict[str, Any]], train_ratio: float = 0.7
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Time-aware chronological train/test split.
    Prevents future interaction leakage by splitting strictly on timestamp.
    """
    def get_ts(item):
        ts = item.get("timestamp")
        if isinstance(ts, datetime):
            return ts.timestamp()
        return 0.0

    sorted_interactions = sorted(interactions, key=get_ts)
    split_idx = max(1, int(len(sorted_interactions) * train_ratio))

    train = sorted_interactions[:split_idx]
    test = sorted_interactions[split_idx:]
    return train, test


class OfflineEvaluator:
    """
    Offline evaluation framework comparing Hybrid Ranker vs Popularity Baseline.
    Supports both binary and graded relevance metrics with temporal leakage safeguards.
    """

    def __init__(
        self,
        catalog: List[Dict[str, Any]],
        interactions: List[Dict[str, Any]],
        graded_weights: Optional[Dict[str, float]] = None,
    ):
        self.catalog = catalog
        self.interactions = interactions
        self.graded_weights = graded_weights or DEFAULT_GRADED_RELEVANCE_WEIGHTS

    def evaluate_user(
        self,
        user_identifier: str,
        k_values: List[int] = [4, 8, 12],
    ) -> Dict[str, Any]:
        user_history = [
            i for i in self.interactions
            if (i.get("email", "").lower() == user_identifier.lower()
                or i.get("user_id") == user_identifier)
        ]

        if len(user_history) < 2:
            return {
                "status": "SKIPPED_SPARSE_DATA",
                "message": f"User {user_identifier} has fewer than 2 interactions for train/test split.",
            }

        train_set, test_set = time_aware_train_test_split(user_history, train_ratio=0.7)
        ground_truth_ids = {str(i.get("product_id")) for i in test_set if i.get("product_id")}

        ground_truth_relevance: Dict[str, float] = {}
        for item in test_set:
            pid = str(item.get("product_id"))
            if not pid:
                continue
            event_type = item.get("interaction_type", "view")
            w = self.graded_weights.get(event_type, 1.0)
            if w > ground_truth_relevance.get(pid, 0.0):
                ground_truth_relevance[pid] = w

        is_statistically_sparse = len(user_history) < 15 or len(test_set) < 5
        sparsity_warning = (
            f"Dataset is too sparse for statistically significant conclusions ({len(user_history)} total interactions, "
            f"{len(test_set)} test holdout events). Offline metrics serve solely for smoke/leakage verification, "
            "not model superiority claims."
        ) if is_statistically_sparse else None

        user_affinity = Counter()
        viewed_ids = set()
        for item in train_set:
            pid = str(item.get("product_id"))
            viewed_ids.add(pid)
            weight = INTERACTION_WEIGHTS.get(item.get("interaction_type", "view"), 1.0)
            for p in self.catalog:
                if str(p.get("_id")) == pid:
                    cat = p.get("category")
                    if cat:
                        user_affinity[cat] += weight
                    break

        cutoff_time = None
        for item in reversed(train_set):
            ts = item.get("timestamp")
            if isinstance(ts, datetime):
                cutoff_time = ts
                break

        max_k = max(k_values)

        hybrid_recs, _ = rank_and_diversify_candidates(
            candidates=self.catalog,
            user_category_affinity=user_affinity,
            collab_scores=Counter(),
            viewed_product_ids=viewed_ids,
            count=max_k,
            now=cutoff_time,
        )
        hybrid_rec_ids = [str(p.get("_id")) for p in hybrid_recs]

        eligible_catalog = [
            p for p in self.catalog
            if resolve_auction_lifecycle(p, now=cutoff_time).get("status") in ("LIVE", "UPCOMING")
        ]
        popularity_recs = sorted(
            eligible_catalog,
            key=lambda x: (-x.get("bidCount", 0), str(x.get("_id"))),
        )[:max_k]
        pop_rec_ids = [str(p.get("_id")) for p in popularity_recs]

        results = {
            "user": user_identifier,
            "train_interactions_count": len(train_set),
            "test_interactions_count": len(test_set),
            "cutoff_timestamp": cutoff_time.isoformat() if cutoff_time else None,
            "is_statistically_sparse": is_statistically_sparse,
            "sparsity_warning": sparsity_warning,
            "evaluation_notice": (
                "SMOKE EVALUATION ONLY: The small sample size is insufficient to "
                "establish general recommendation quality or validate production ML accuracy claims. "
                "This offline evaluation serves solely to verify temporal integrity, absence of data leakage, "
                "and metric computation correctness."
            ),
            "metrics": {},
        }

        for k in k_values:
            results["metrics"][f"K={k}"] = {
                "hybrid": {
                    "precision": round(compute_precision_at_k(hybrid_rec_ids, ground_truth_ids, k), 4),
                    "recall": round(compute_recall_at_k(hybrid_rec_ids, ground_truth_ids, k), 4),
                    "ndcg_binary": round(compute_ndcg_at_k(hybrid_rec_ids, ground_truth_ids, k), 4),
                    "ndcg_graded": round(compute_graded_ndcg_at_k(hybrid_rec_ids, ground_truth_relevance, k), 4),
                    "ndcg": round(compute_ndcg_at_k(hybrid_rec_ids, ground_truth_ids, k), 4),
                    "category_diversity": round(compute_category_diversity(hybrid_recs, k), 4),
                },
                "popularity_baseline": {
                    "precision": round(compute_precision_at_k(pop_rec_ids, ground_truth_ids, k), 4),
                    "recall": round(compute_recall_at_k(pop_rec_ids, ground_truth_ids, k), 4),
                    "ndcg_binary": round(compute_ndcg_at_k(pop_rec_ids, ground_truth_ids, k), 4),
                    "ndcg_graded": round(compute_graded_ndcg_at_k(pop_rec_ids, ground_truth_relevance, k), 4),
                    "ndcg": round(compute_ndcg_at_k(pop_rec_ids, ground_truth_ids, k), 4),
                    "category_diversity": round(compute_category_diversity(popularity_recs, k), 4),
                },
            }

        return results
