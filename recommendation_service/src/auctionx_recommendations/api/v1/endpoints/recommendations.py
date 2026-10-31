"""
Recommendation serving endpoints.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from auctionx_recommendations.api.dependencies import (
    get_active_db,
    get_active_internal_key,
    get_recommendation_service,
    get_settings,
)
from auctionx_recommendations.application.services.recommendation_service import RecommendationService
from auctionx_recommendations.infrastructure.config.settings import Settings
from auctionx_recommendations.infrastructure.security.internal_auth import verify_internal_service_key

router = APIRouter()


async def _handle_recommendation_request(
    email: Optional[str],
    count: int,
    session_id: Optional[str],
    request: Request,
    service: RecommendationService,
    settings: Optional[Settings],
):
    """Common handler enforcing internal auth on personalized requests and calling RecommendationService."""
    if get_active_db(request) is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    raw_email = (email or "").strip().lower()
    is_guest = not raw_email or raw_email in ("guest", "anonymous")
    clean_email = "" if is_guest else raw_email

    # Authoritative User Personalization Guard:
    if clean_email:
        configured_key = get_active_internal_key(request)
        if not configured_key:
            raise HTTPException(
                status_code=503,
                detail="Personalized user recommendations are disabled: INTERNAL_SERVICE_KEY is not configured",
            )
        incoming_key = request.headers.get("x-internal-service-key", "").strip()
        if not verify_internal_service_key(incoming_key, configured_key):
            raise HTTPException(
                status_code=403,
                detail="Personalized user recommendations require trusted internal service authorization",
            )

    slate = service.get_recommendations(
        email=clean_email,
        count=count,
        session_id=session_id,
        include_diagnostics=True,
    )
    return slate.to_response_dict()


@router.get("/api/recommendations")
@router.get("/recommendations")
async def get_guest_or_query_recommendations(
    request: Request,
    email: Optional[str] = Query(default=None),
    session_id: Optional[str] = Query(default=None),
    count: int = Query(default=10, ge=1, le=50),
    service: RecommendationService = Depends(get_recommendation_service),
    settings: Optional[Settings] = Depends(get_settings),
):
    """Serve guest recommendations or query-parameter email/session recommendations."""
    return await _handle_recommendation_request(
        email=email,
        count=count,
        session_id=session_id,
        request=request,
        service=service,
        settings=settings,
    )


@router.get("/api/recommendations/{email}")
@router.get("/recommendations/{email}")
async def get_user_recommendations(
    email: str,
    request: Request,
    session_id: Optional[str] = Query(default=None),
    count: int = Query(default=10, ge=1, le=50),
    service: RecommendationService = Depends(get_recommendation_service),
    settings: Optional[Settings] = Depends(get_settings),
):
    """Serve recommendations for a specific user email or 'guest' keyword."""
    return await _handle_recommendation_request(
        email=email,
        count=count,
        session_id=session_id,
        request=request,
        service=service,
        settings=settings,
    )
