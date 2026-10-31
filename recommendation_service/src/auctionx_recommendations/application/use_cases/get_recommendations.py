"""
Get Recommendations Use Case.
Orchestrates candidate retrieval across channels, collaborative filtering,
domain ranking, diversity enforcement, and versioned caching.
"""

from collections import Counter
import json
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple
from bson import ObjectId

from ...domain.models.recommendation import RecommendationSlate
from ...domain.ranking.engine import rank_and_diversify_candidates
from ...domain.ranking.features import INTERACTION_WEIGHTS
from ..ports.auction_repository import AuctionRepository
from ..ports.interaction_repository import InteractionRepository
from ..ports.cache import CachePort
from ...infrastructure.security.pseudonymization import compute_pseudonymous_user_id


class GetRecommendationsUseCase:
    """Use case handling personalized and cold-start recommendation requests."""

    def __init__(
        self,
        auction_repo: AuctionRepository,
        interaction_repo: InteractionRepository,
        cache: Optional[CachePort] = None,
    ):
        self.auction_repo = auction_repo
        self.interaction_repo = interaction_repo
        self.cache = cache

    def execute(
        self,
        email: Optional[str] = None,
        count: int = 10,
        session_id: Optional[str] = None,
        include_diagnostics: bool = True,
    ) -> RecommendationSlate:
        """
        Executes the recommendation pipeline with cache resolution,
        multi-channel candidate generation, and multi-factor ranking.
        """
        clamped_count = max(1, min(int(count), 50))
        raw_email = (email or "").strip().lower()
        is_guest = not raw_email or raw_email in ("guest", "anonymous")
        clean_email = "" if is_guest else raw_email
        clean_session_id = session_id.strip() if session_id else ""

        # 1. Resolve cache key and TTL
        cache_key, cache_ttl = self._resolve_cache_key(clean_email, clean_session_id, clamped_count)

        # 2. Check cache
        if self.cache and self.cache.is_available():
            cached_data = self.cache.get(cache_key)
            if cached_data:
                try:
                    cached_obj = json.loads(cached_data)
                    if isinstance(cached_obj, dict) and "items" in cached_obj:
                        items = cached_obj["items"]
                        pers = cached_obj.get("personalized", False if is_guest else True)
                        diag = cached_obj.get("diagnostics")
                    else:
                        items = cached_obj
                        pers = False if is_guest else True
                        diag = None

                    return RecommendationSlate(
                        recommendation_id=str(uuid.uuid4()),
                        items=items,
                        personalized=pers,
                        cache_hit=True,
                        diagnostics=diag,
                    )
                except Exception:
                    pass

        # 3. Compute recommendations
        raw_recommendations, is_personalized, diagnostics = self.compute_raw_recommendations(
            email=clean_email,
            count=clamped_count,
            session_id=clean_session_id,
        )

        # 4. Serialize for response & caching
        serialized = self._serialize_products(raw_recommendations)

        # 5. Populate cache
        if self.cache and self.cache.is_available() and serialized:
            try:
                cache_payload = {
                    "items": serialized,
                    "personalized": is_personalized,
                    "diagnostics": diagnostics,
                }
                self.cache.setex(cache_key, cache_ttl, json.dumps(cache_payload, default=str))
            except Exception:
                pass

        return RecommendationSlate(
            recommendation_id=str(uuid.uuid4()),
            items=serialized,
            personalized=is_personalized,
            cache_hit=False,
            diagnostics=diagnostics if include_diagnostics else None,
        )

    def compute_raw_recommendations(
        self,
        email: str,
        count: int = 10,
        session_id: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], bool, Dict[str, Any]]:
        """
        Pure computational recommendation engine: queries repos, extracts user affinity,
        retrieves candidates across channels, and ranks using domain scoring.
        """
        user_interactions: List[Dict[str, Any]] = []
        viewed_product_ids: Set[str] = set()
        user_category_affinity: Counter = Counter()
        collab_scores: Counter = Counter()
        is_personalized = False

        # Step 1: User / Session Signal Ingestion
        if email:
            pseudo_id = compute_pseudonymous_user_id(email)
            user_interactions = self.interaction_repo.get_user_interactions(email=email, user_id=pseudo_id, limit=100)
        elif session_id:
            user_interactions = self.interaction_repo.get_session_interactions(session_id=session_id, limit=100)

        if user_interactions:
            is_personalized = True
            viewed_product_ids = {
                str(i["product_id"]) for i in user_interactions if "product_id" in i
            }

            # 1.1 Category Affinity Calculation
            product_interaction_scores: Counter = Counter()
            for interaction in user_interactions:
                itype = interaction.get("interaction_type", "view")
                weight = INTERACTION_WEIGHTS.get(itype, 1.0)
                product_interaction_scores[str(interaction.get("product_id"))] += weight

            if viewed_product_ids:
                interacted_prods = self.auction_repo.get_products_by_ids(
                    list(viewed_product_ids),
                    projection={"category": 1, "_id": 1},
                )
                for p in interacted_prods:
                    cat = p.get("category")
                    if cat:
                        user_category_affinity[cat] += product_interaction_scores.get(str(p["_id"]), 1.0)

            # 1.2 Collaborative Signal Generation
            if viewed_product_ids:
                co_interactions = self.interaction_repo.get_co_interactions(
                    product_ids=list(viewed_product_ids),
                    exclude_email=email if email else None,
                    exclude_user_id=pseudo_id if email else None,
                    limit=300,
                )
                similar_users = {
                    i.get("user_id") or i.get("email")
                    for i in co_interactions
                    if i.get("user_id") or i.get("email")
                }
                if similar_users:
                    similar_user_actions = self.interaction_repo.get_similar_user_interactions(
                        user_identifiers=list(similar_users),
                        exclude_product_ids=list(viewed_product_ids),
                        limit=500,
                    )
                    for action in similar_user_actions:
                        pid = action.get("product_id")
                        if pid and ObjectId.is_valid(pid):
                            weight = INTERACTION_WEIGHTS.get(action.get("interaction_type", "view"), 1.0)
                            collab_scores[pid] += weight

        # Step 2: Multi-Channel Candidate Retrieval
        candidate_map: Dict[str, Dict[str, Any]] = {}
        channel_counts = {
            "category_channel": 0,
            "collaborative_channel": 0,
            "popular_channel": 0,
            "freshness_channel": 0,
            "upcoming_channel": 0,
        }

        # 2.1 Channel A: Category Affinity
        top_categories = [cat for cat, _ in user_category_affinity.most_common(4)]
        if top_categories:
            try:
                cat_candidates = self.auction_repo.get_candidates_by_categories(top_categories, limit=count * 2)
                for c in cat_candidates:
                    candidate_map[str(c["_id"])] = c
                channel_counts["category_channel"] = len(cat_candidates)
            except Exception:
                pass

        # 2.2 Channel B: Collaborative Candidates
        top_collab_pids = [pid for pid, _ in collab_scores.most_common(count * 2)]
        if top_collab_pids:
            try:
                collab_candidates = self.auction_repo.get_products_by_ids(top_collab_pids)
                for c in collab_candidates:
                    candidate_map[str(c["_id"])] = c
                channel_counts["collaborative_channel"] = len(collab_candidates)
            except Exception:
                pass

        # 2.3 Channel C: Popular Active Auctions
        try:
            popular_candidates = self.auction_repo.get_popular_active_candidates(limit=count * 2)
            for c in popular_candidates:
                candidate_map[str(c["_id"])] = c
            channel_counts["popular_channel"] = len(popular_candidates)
        except Exception:
            pass

        # 2.4 Channel D: Fresh Listings
        try:
            fresh_candidates = self.auction_repo.get_fresh_active_candidates(limit=count)
            for c in fresh_candidates:
                candidate_map[str(c["_id"])] = c
            channel_counts["freshness_channel"] = len(fresh_candidates)
        except Exception:
            pass

        # 2.5 Channel E: Upcoming Auctions (Backfill if candidate pool is small)
        if len(candidate_map) < count * 2:
            try:
                upcoming_candidates = self.auction_repo.get_upcoming_candidates(limit=count)
                for c in upcoming_candidates:
                    candidate_map[str(c["_id"])] = c
                channel_counts["upcoming_channel"] = len(upcoming_candidates)
            except Exception:
                pass

        # Step 3: Multi-Factor Ranking & Diversity Optimization
        raw_candidates = list(candidate_map.values())
        ranked_products, ranking_diag = rank_and_diversify_candidates(
            candidates=raw_candidates,
            user_category_affinity=user_category_affinity,
            collab_scores=collab_scores,
            viewed_product_ids=viewed_product_ids,
            count=count,
            max_per_category=3,
        )

        diagnostics = {
            "channel_counts": channel_counts,
            "ranking": ranking_diag,
            "algorithm": "heuristic_hybrid_ranker_v2",
            "model_type": "heuristic_rule_composite",
            "is_ml_trained": False,
        }

        return ranked_products, is_personalized, diagnostics

    def _resolve_cache_key(self, email: str, session_id: str, count: int) -> Tuple[str, int]:
        """Resolves the cache key and appropriate TTL."""
        if email:
            version = "1"
            if self.cache:
                version = self.cache.get_user_cache_version(email)
            return f"recommendations:{email}:v{version}:{count}", 1800  # 30 minutes
        elif session_id:
            return f"recommendations:session:{session_id}:{count}", 120  # 2 minutes
        else:
            return f"recommendations:guest:v1:{count}", 300  # 5 minutes

    def _serialize_products(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Converts ObjectId and non-serializable fields to JSON-safe primitives."""
        res = []
        for p in products:
            item = dict(p)
            if "_id" in item:
                item["_id"] = str(item["_id"])
            res.append(item)
        return res
