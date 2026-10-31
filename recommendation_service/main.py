"""
AuctionX — Recommendation Microservice (v2.0)
Root entrypoint and backward-compatibility facade delegating to auctionx_recommendations.
"""

import os
import sys
from typing import Any, Optional

# Ensure src/ is on sys.path
_SRC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
if _SRC_DIR not in sys.path:
    sys.path.insert(0, _SRC_DIR)

from auctionx_recommendations.main import create_app, lifespan
from auctionx_recommendations.api.v1.schemas import (
    InteractionSchema as Interaction,
    BatchInteractionRequestSchema as BatchInteractionRequest,
    RecommendationRequestSchema as RecommendationRequest,
)
from auctionx_recommendations.infrastructure.cache.redis_cache import (
    build_redis_client,
    RedisCacheAdapter,
)
from auctionx_recommendations.infrastructure.database.repositories.mongo_auction_repository import (
    MongoAuctionRepository,
)
from auctionx_recommendations.infrastructure.database.repositories.mongo_interaction_repository import (
    MongoInteractionRepository,
)
from auctionx_recommendations.infrastructure.security.pseudonymization import (
    compute_pseudonymous_user_id,
)
from auctionx_recommendations.infrastructure.security.internal_auth import (
    verify_internal_service_key as _core_verify_key,
)
from auctionx_recommendations.application.use_cases.get_recommendations import (
    GetRecommendationsUseCase,
)

# Root application instance constructed via application factory
app = create_app()

# Module-level handles for backward compatibility and test mock patching
mongo_client = None
db = None
redis_client = None
INTERNAL_SERVICE_KEY = app.state.settings.internal_service_key


def verify_internal_service_key(incoming_key: Optional[str]) -> bool:
    """Verifies incoming internal service key with dynamic fallback for test monkeypatching."""
    current_key = getattr(sys.modules.get("main"), "INTERNAL_SERVICE_KEY", INTERNAL_SERVICE_KEY)
    return _core_verify_key(incoming_key, configured_key=current_key)


def compute_recommendations(
    email: str,
    count: int = 10,
    include_diagnostics: bool = False,
    session_id: Optional[str] = None,
) -> Any:
    """Direct computation facade matching legacy contract for offline and script callers."""
    main_mod = sys.modules.get("main")
    active_db = getattr(main_mod, "db", None) if main_mod else None
    if active_db is None:
        raise RuntimeError("Database connection not available")

    active_redis = getattr(main_mod, "redis_client", None) if main_mod else None
    cache_adapter = RedisCacheAdapter(active_redis)
    auction_repo = MongoAuctionRepository(active_db)
    interaction_repo = MongoInteractionRepository(active_db)

    use_case = GetRecommendationsUseCase(
        auction_repo=auction_repo,
        interaction_repo=interaction_repo,
        cache=cache_adapter,
    )

    ranked, is_pers, diag = use_case.compute_raw_recommendations(
        email=email,
        count=count,
        session_id=session_id,
    )

    if include_diagnostics:
        return ranked, is_pers, diag
    return ranked, is_pers


__all__ = [
    "app",
    "lifespan",
    "mongo_client",
    "db",
    "redis_client",
    "INTERNAL_SERVICE_KEY",
    "verify_internal_service_key",
    "compute_pseudonymous_user_id",
    "compute_recommendations",
    "build_redis_client",
    "Interaction",
    "BatchInteractionRequest",
    "RecommendationRequest",
]
