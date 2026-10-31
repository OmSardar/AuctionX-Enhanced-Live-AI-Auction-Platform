"""
Endpoints subpackage.
"""

from .health import router as health_router
from .interactions import router as interactions_router
from .recommendations import router as recommendations_router

__all__ = ["health_router", "interactions_router", "recommendations_router"]
