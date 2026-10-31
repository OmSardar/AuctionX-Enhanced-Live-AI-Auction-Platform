"""
Health, readiness, and metrics probes.
"""

from typing import Any, Dict
import sys
from fastapi import APIRouter, HTTPException, Request

from auctionx_recommendations.infrastructure.observability.metrics import metrics
from auctionx_recommendations.api.dependencies import get_active_db, get_active_redis

router = APIRouter()


@router.get("/health")
@router.get("/api/health")
async def health_check(request: Request) -> Dict[str, Any]:
    """Liveness probe: verifies process health and returns connection status."""
    main_mod = sys.modules.get("main")
    active_client = (
        main_mod.mongo_client
        if main_mod and hasattr(main_mod, "mongo_client")
        else getattr(request.app.state, "mongo_client", None)
    )
    active_db = get_active_db(request)
    active_redis = get_active_redis(request)

    is_mongo_ok = False
    if active_client:
        try:
            active_client.admin.command("ping")
            is_mongo_ok = True
        except Exception:
            is_mongo_ok = False

    return {
        "status": "healthy" if is_mongo_ok else "degraded",
        "service": "recommendation_service",
        "database": active_db.name if active_db is not None else None,
        "mongodb": is_mongo_ok,
        "redis": active_redis is not None,
    }


@router.get("/ready")
@router.get("/api/ready")
async def readiness_check(request: Request) -> Dict[str, Any]:
    """Readiness probe: strictly verifies live database connection before serving traffic."""
    main_mod = sys.modules.get("main")
    active_client = (
        main_mod.mongo_client
        if main_mod and hasattr(main_mod, "mongo_client")
        else getattr(request.app.state, "mongo_client", None)
    )
    active_db = get_active_db(request)
    active_redis = get_active_redis(request)

    if not active_client or active_db is None:
        raise HTTPException(status_code=503, detail="Database client not initialized")

    try:
        active_client.admin.command("ping")
        return {
            "status": "ready",
            "database": active_db.name,
            "mongodb": True,
            "redis": active_redis is not None,
        }
    except Exception as err:
        raise HTTPException(
            status_code=503,
            detail=f"Database readiness ping failed: {str(err)}",
        )


@router.get("/metrics")
@router.get("/api/metrics")
async def get_metrics() -> Dict[str, Any]:
    """Operational telemetry snapshot exposing request counts and latencies."""
    return metrics.get_snapshot()
