"""
Interaction telemetry ingestion endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from auctionx_recommendations.api.dependencies import get_active_db, get_interaction_service
from auctionx_recommendations.api.v1.schemas import InteractionSchema, BatchInteractionRequestSchema
from auctionx_recommendations.application.services.interaction_service import InteractionService

router = APIRouter()


@router.post("/api/track")
@router.post("/track")
async def track_interaction(
    interaction: InteractionSchema,
    request: Request,
    service: InteractionService = Depends(get_interaction_service),
):
    """
    Track user interactions (views, clicks, bids, purchases, impressions) with strict schema
    validation, authoritative business event gating, product existence/visibility checks,
    duplicate-window suppression, and O(1) versioned cache invalidation.
    """
    if get_active_db(request) is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    incoming_key = request.headers.get("x-internal-service-key", "").strip()
    return service.record_single(
        interaction_dict=interaction.model_dump(),
        incoming_service_key=incoming_key,
    )


@router.post("/api/track/batch")
@router.post("/track/batch")
async def track_batch_interactions(
    batch_req: BatchInteractionRequestSchema,
    request: Request,
    service: InteractionService = Depends(get_interaction_service),
):
    """
    Batch interaction tracking for viewport impressions and buffered telemetry events.
    Applies per-item validation, identity derivation, and deduplication with bounded batch size (<=25).
    """
    if get_active_db(request) is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    items = batch_req.interactions or batch_req.batch or []
    item_dicts = [i.model_dump() for i in items]
    incoming_key = request.headers.get("x-internal-service-key", "").strip()

    return service.record_batch(
        interactions=item_dicts,
        incoming_service_key=incoming_key,
    )
