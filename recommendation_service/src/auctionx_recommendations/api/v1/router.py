"""
Central v1 API Router.
"""

from fastapi import APIRouter
from .endpoints.health import router as health_router
from .endpoints.interactions import router as interactions_router
from .endpoints.recommendations import router as recommendations_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router)
api_v1_router.include_router(interactions_router)
api_v1_router.include_router(recommendations_router)
