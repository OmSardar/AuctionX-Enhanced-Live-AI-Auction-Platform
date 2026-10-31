"""
FastAPI application factory and lifecycle entrypoint for AuctionX Recommendation Service.
"""

from contextlib import asynccontextmanager
import os
import sys
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .infrastructure.config.settings import Settings, get_settings
from .infrastructure.database.mongo_client import create_mongo_client, init_mongo_indexes
from .infrastructure.database.repositories.mongo_auction_repository import MongoAuctionRepository
from .infrastructure.database.repositories.mongo_interaction_repository import MongoInteractionRepository
from .infrastructure.cache.redis_cache import RedisCacheAdapter, build_redis_client
from .application.use_cases.get_recommendations import GetRecommendationsUseCase
from .application.use_cases.record_interactions import RecordInteractionsUseCase
from .application.services.recommendation_service import RecommendationService
from .application.services.interaction_service import InteractionService
from .api.middleware.request_id import RequestIdMiddleware
from .api.middleware.access_logging import AccessLoggingMiddleware
from .api.exception_handlers import register_exception_handlers
from .api.v1.router import api_v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for MongoDB and Redis connections."""
    app_settings = getattr(app.state, "settings", None) or get_settings()

    # 1. MongoDB Connection
    mongo_client = None
    db = None
    try:
        mongo_client, db = create_mongo_client(app_settings)
        mongo_client.admin.command("ping")
        print(f"Connected to MongoDB database: {app_settings.mongodb_db}")
        init_mongo_indexes(db)
    except Exception as e:
        print(f"WARNING: MongoDB connection could not be established at startup: {e}")

    # 2. Redis Connection
    redis_client = None
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        main_mod = sys.modules.get("main")
        redis_builder = getattr(main_mod, "build_redis_client", build_redis_client) if main_mod else build_redis_client
        try:
            redis_client = redis_builder(redis_url)
            redis_client.ping()
            print("Connected to Redis cache")
        except Exception as e:
            print(f"Redis unavailable, running without cache: {e}")
            redis_client = None
    else:
        print("No REDIS_URL configured, running without cache")

    # 3. Initialize Adapters & Services
    cache_adapter = RedisCacheAdapter(redis_client)
    auction_repo = MongoAuctionRepository(db) if db is not None else None
    interaction_repo = MongoInteractionRepository(db) if db is not None else None

    get_recs_uc = (
        GetRecommendationsUseCase(auction_repo, interaction_repo, cache_adapter)
        if auction_repo and interaction_repo
        else None
    )
    record_interactions_uc = (
        RecordInteractionsUseCase(
            auction_repo,
            interaction_repo,
            cache_adapter,
            internal_service_key=app_settings.internal_service_key,
        )
        if auction_repo and interaction_repo
        else None
    )

    recommendation_service = RecommendationService(get_recs_uc) if get_recs_uc else None
    interaction_service = InteractionService(record_interactions_uc) if record_interactions_uc else None

    # 4. Attach state handles
    app.state.settings = app_settings
    app.state.mongo_client = mongo_client
    app.state.db = db
    app.state.redis_client = redis_client
    app.state.cache = cache_adapter
    app.state.auction_repo = auction_repo
    app.state.interaction_repo = interaction_repo
    app.state.get_recommendations_uc = get_recs_uc
    app.state.record_interactions_uc = record_interactions_uc
    app.state.recommendation_service = recommendation_service
    app.state.interaction_service = interaction_service

    # Sync with main module facade if loaded
    main_mod = sys.modules.get("main")
    if main_mod:
        main_mod.mongo_client = mongo_client
        main_mod.db = db
        main_mod.redis_client = redis_client

    yield

    # Graceful shutdown
    if mongo_client:
        try:
            mongo_client.close()
        except Exception:
            pass
    if redis_client:
        try:
            redis_client.close()
        except Exception:
            pass

    if main_mod:
        main_mod.mongo_client = None
        main_mod.db = None
        main_mod.redis_client = None


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    """
    Constructs and configures the FastAPI application instance with layered architecture dependencies.
    """
    app_settings = settings or get_settings()

    app = FastAPI(
        title="Auction X Recommendation Service",
        version="2.0.0",
        lifespan=lifespan,
    )

    # Attach initial settings
    app.state.settings = app_settings

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.cors_origins,
        allow_origin_regex=r"^https://auction-x-enhanced-live-ai-auction.*\.vercel\.app$",
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS", "HEAD"],
        allow_headers=["*"],
    )

    # Correlation ID & Access Logging Middleware
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(AccessLoggingMiddleware)

    # Domain Exception Handlers
    register_exception_handlers(app)

    # Register API v1 Endpoints
    app.include_router(api_v1_router)

    return app


# Default application instance
app = create_app()
