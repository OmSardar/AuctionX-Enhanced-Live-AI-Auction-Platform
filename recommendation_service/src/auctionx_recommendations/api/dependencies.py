"""
FastAPI dependency injection providers with dynamic resolution for runtime and test environments.
"""

from typing import Optional
import sys
from fastapi import Depends, Request
from pymongo.database import Database

from ..infrastructure.config.settings import Settings, get_settings
from ..application.services.recommendation_service import RecommendationService
from ..application.services.interaction_service import InteractionService
from ..application.ports.auction_repository import AuctionRepository
from ..application.ports.interaction_repository import InteractionRepository
from ..application.ports.cache import CachePort
from ..infrastructure.database.repositories.mongo_auction_repository import MongoAuctionRepository
from ..infrastructure.database.repositories.mongo_interaction_repository import MongoInteractionRepository
from ..infrastructure.cache.redis_cache import RedisCacheAdapter
from ..application.use_cases.get_recommendations import GetRecommendationsUseCase
from ..application.use_cases.record_interactions import RecordInteractionsUseCase


def get_active_db(request: Request) -> Optional[Database]:
    """Dynamically resolves the active database, respecting test patches on main.db."""
    main_mod = sys.modules.get("main")
    if main_mod and hasattr(main_mod, "db") and main_mod.db is not None:
        return main_mod.db
    return getattr(request.app.state, "db", None)


def get_active_redis(request: Request):
    """Dynamically resolves the active Redis client, respecting test patches on main.redis_client."""
    main_mod = sys.modules.get("main")
    if main_mod and hasattr(main_mod, "redis_client"):
        return main_mod.redis_client
    return getattr(request.app.state, "redis_client", None)


def get_active_internal_key(request: Request) -> str:
    """Dynamically resolves the active internal service key, respecting test patches on main.INTERNAL_SERVICE_KEY."""
    main_mod = sys.modules.get("main")
    if main_mod and hasattr(main_mod, "INTERNAL_SERVICE_KEY") and main_mod.INTERNAL_SERVICE_KEY is not None:
        return main_mod.INTERNAL_SERVICE_KEY
    settings = get_settings(request)
    return getattr(settings, "internal_service_key", "")


def get_settings(request: Request) -> Settings:
    """Provides application Settings."""
    return getattr(request.app.state, "settings", None) or Settings()


def get_auction_repository(request: Request) -> Optional[AuctionRepository]:
    """Provides AuctionRepository adapter."""
    db = get_active_db(request)
    if db is not None:
        return MongoAuctionRepository(db)
    return getattr(request.app.state, "auction_repo", None)


def get_interaction_repository(request: Request) -> Optional[InteractionRepository]:
    """Provides InteractionRepository adapter."""
    db = get_active_db(request)
    if db is not None:
        return MongoInteractionRepository(db)
    return getattr(request.app.state, "interaction_repo", None)


def get_cache(request: Request) -> CachePort:
    """Provides CachePort adapter."""
    redis_client = get_active_redis(request)
    if redis_client is not None:
        return RedisCacheAdapter(redis_client)
    return getattr(request.app.state, "cache", RedisCacheAdapter(None))


def get_recommendation_service(request: Request) -> RecommendationService:
    """Provides RecommendationService application service."""
    db = get_active_db(request)
    redis_client = get_active_redis(request)
    if db is not None:
        cache = RedisCacheAdapter(redis_client)
        auction_repo = MongoAuctionRepository(db)
        interaction_repo = MongoInteractionRepository(db)
        uc = GetRecommendationsUseCase(auction_repo, interaction_repo, cache)
        return RecommendationService(uc)
    return getattr(request.app.state, "recommendation_service", None)


def get_interaction_service(request: Request) -> InteractionService:
    """Provides InteractionService application service."""
    db = get_active_db(request)
    redis_client = get_active_redis(request)
    internal_key = get_active_internal_key(request)
    if db is not None:
        cache = RedisCacheAdapter(redis_client)
        auction_repo = MongoAuctionRepository(db)
        interaction_repo = MongoInteractionRepository(db)
        uc = RecordInteractionsUseCase(
            auction_repo=auction_repo,
            interaction_repo=interaction_repo,
            cache=cache,
            internal_service_key=internal_key,
        )
        return InteractionService(uc)
    return getattr(request.app.state, "interaction_service", None)
