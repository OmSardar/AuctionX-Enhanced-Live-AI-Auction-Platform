"""
Recommendation Ranking Engine.
Coordinates candidate scoring, 0.4x repetition dampening, deterministic sorting,
category diversity enforcement (max_per_category=3), and deferred backfilling.
"""

from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from ..policies.auction_eligibility import resolve_auction_lifecycle
from .features import DEFAULT_RANKING_WEIGHTS
from .scoring import calculate_feature_scores


def rank_and_diversify_candidates(
    candidates: List[Dict[str, Any]],
    user_category_affinity: Counter,
    collab_scores: Counter,
    viewed_product_ids: Set[str],
    count: int = 10,
    max_per_category: int = 3,
    weights: Optional[Dict[str, float]] = None,
    now: Optional[datetime] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Ranks candidates using multi-factor composite scoring, applies repetition dampening
    and category diversity suppression, and produces deterministic output.

    Sorting hierarchy:
    1. LIVE auctions prioritized over UPCOMING (-is_live)
    2. Highest normalized composite score [0.0, 1.0] (-score)
    3. Tie-break on bidCount DESC (-bidCount)
    4. Tie-break on _id string ASC (id_str)
    """
    if now is None:
        now = datetime.now(timezone.utc)
    w = weights or DEFAULT_RANKING_WEIGHTS

    max_bids = max([c.get("bidCount", 0) for c in candidates], default=1)

    scored_items = []
    for product in candidates:
        lifecycle = resolve_auction_lifecycle(product, now=now)
        # Strict Eligibility Invariant: Filter out ended or ineligible auctions
        if lifecycle.get("status") not in ("LIVE", "UPCOMING"):
            continue

        features = calculate_feature_scores(
            product=product,
            lifecycle=lifecycle,
            user_category_affinity=user_category_affinity,
            collab_scores=collab_scores,
            max_bids=max_bids,
            now=now,
        )

        composite_score = sum(features[k] * w.get(k, 0.0) for k in features)

        # Repetition Control: Dampen recently viewed items (0.4x penalty)
        # Prevents empty recommendation lists on small catalogs while letting unviewed items rank higher
        pid_str = str(product.get("_id", ""))
        is_viewed = pid_str in viewed_product_ids
        if is_viewed:
            composite_score *= 0.4

        is_live = 1 if lifecycle.get("status") == "LIVE" else 0

        scored_items.append({
            "product": product,
            "lifecycle": lifecycle,
            "features": features,
            "score": round(composite_score, 5),
            "is_viewed": is_viewed,
            "is_live": is_live,
            "id_str": pid_str,
            "category": product.get("category", "General"),
            "bidCount": product.get("bidCount", 0),
        })

    # Deterministic sorting:
    scored_items.sort(key=lambda x: (-x["is_live"], -x["score"], -x["bidCount"], x["id_str"]))

    # Category Diversity Enforcement:
    selected_products = []
    deferred_products = []
    category_counts = Counter()

    for item in scored_items:
        cat = item["category"]
        prod_payload = dict(item["product"])
        prod_payload["lifecycleStatus"] = item["lifecycle"].get("status")
        prod_payload["secondsRemaining"] = item["lifecycle"].get("seconds_remaining")
        prod_payload["secondsToStart"] = item["lifecycle"].get("seconds_to_start")

        if category_counts[cat] < max_per_category:
            selected_products.append(prod_payload)
            category_counts[cat] += 1
        else:
            deferred_products.append(prod_payload)

        if len(selected_products) >= count:
            break

    # If diverse selection hasn't met target count, backfill from deferred items
    if len(selected_products) < count and deferred_products:
        needed = count - len(selected_products)
        selected_products.extend(deferred_products[:needed])

    diagnostics = {
        "total_candidates_evaluated": len(candidates),
        "eligible_scored": len(scored_items),
        "selected_count": len(selected_products),
        "categories_represented": len(category_counts),
        "repetition_dampened_count": sum(1 for x in scored_items if x["is_viewed"]),
    }

    return selected_products[:count], diagnostics
