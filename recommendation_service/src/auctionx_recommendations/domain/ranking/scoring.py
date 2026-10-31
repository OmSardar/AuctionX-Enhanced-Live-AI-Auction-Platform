"""
Multi-factor feature scoring for candidate auctions.
"""

from collections import Counter
from datetime import datetime, timezone
import math
from typing import Any, Dict, Optional

from ..policies.auction_eligibility import parse_iso_or_legacy_date


def calculate_feature_scores(
    product: Dict[str, Any],
    lifecycle: Dict[str, Any],
    user_category_affinity: Counter,
    collab_scores: Counter,
    max_bids: int = 1,
    now: Optional[datetime] = None,
) -> Dict[str, float]:
    """
    Computes individual normalized feature sub-scores in range [0.0, 1.0].
    Features:
    1. Category Affinity Score [0, 1]
    2. Collaborative Score [0, 1]
    3. Popularity Score [0, 1] (Log-scaled on bidCount and viewCount)
    4. Freshness Score [0, 1] (Exponential decay on listing age with 7-day half-life)
    5. Controlled Urgency Score [0, 1] (Ending-soon boost strictly for LIVE auctions closing in <24h)
    """
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    pid_str = str(product.get("_id", ""))
    cat = product.get("category", "")

    # 1. Category Affinity Score [0, 1]
    max_cat_score = max(user_category_affinity.values()) if user_category_affinity else 1.0
    raw_cat_score = user_category_affinity.get(cat, 0.0)
    cat_score = min(1.0, raw_cat_score / max_cat_score) if max_cat_score > 0 else 0.0

    # 2. Collaborative Score [0, 1]
    max_collab_score = max(collab_scores.values()) if collab_scores else 1.0
    raw_collab = collab_scores.get(pid_str, 0.0)
    collab_score = min(1.0, raw_collab / max_collab_score) if max_collab_score > 0 else 0.0

    # 3. Popularity Score [0, 1] (Log-scaled on bidCount and viewCount)
    bids = float(product.get("bidCount") or 0)
    views = float(product.get("viewCount") or 0)
    popularity_signal = bids * 2.0 + views * 0.1
    norm_denom = math.log1p(max(10.0, float(max_bids * 2)))
    pop_score = min(1.0, math.log1p(popularity_signal) / norm_denom) if norm_denom > 0 else 0.0

    # 4. Freshness Score [0, 1] (Exponential decay on listing age)
    created_at = product.get("createdAt")
    created_dt = parse_iso_or_legacy_date(created_at)
    if created_dt:
        age_days = max(0.0, (now - created_dt).total_seconds() / 86400.0)
        # Half-life of 7 days: fresh items within 7 days retain >0.5 freshness
        fresh_score = math.exp(-0.099 * age_days)
    else:
        fresh_score = 0.5  # Neutral default when timestamp missing

    # 5. Controlled Urgency Score [0, 1] (Ending-soon boost strictly for LIVE auctions)
    # Urgency only applies to auctions closing in <24 hours. Does not apply to upcoming/ended.
    urgency_score = 0.0
    if lifecycle.get("status") == "LIVE":
        sec_rem = lifecycle.get("seconds_remaining")
        if sec_rem is not None and sec_rem > 0:
            hours_rem = sec_rem / 3600.0
            if hours_rem <= 24.0:
                # Linearly scales from 1.0 (closing right now) to 0.0 (24h remaining)
                urgency_score = max(0.0, min(1.0, (24.0 - hours_rem) / 24.0))

    return {
        "category_affinity": round(cat_score, 4),
        "collaborative": round(collab_score, 4),
        "popularity": round(pop_score, 4),
        "freshness": round(fresh_score, 4),
        "urgency": round(urgency_score, 4),
    }
