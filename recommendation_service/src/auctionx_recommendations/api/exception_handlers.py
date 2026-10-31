"""
FastAPI exception handlers mapping domain exceptions to standard HTTP error responses.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pymongo.errors import DuplicateKeyError

from ..domain.exceptions import (
    AuthenticationError,
    DuplicateEventConflictError,
    ProductNotFoundError,
    AuctionModeratedError,
    ServiceUnavailableError,
)
from ..infrastructure.observability.logging import logger


def register_exception_handlers(app: FastAPI) -> None:
    """Register domain-to-HTTP exception translators on the FastAPI app instance."""

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(ProductNotFoundError)
    async def product_not_found_handler(request: Request, exc: ProductNotFoundError):
        return JSONResponse(status_code=404, content={"detail": exc.message})

    @app.exception_handler(AuctionModeratedError)
    async def auction_moderated_handler(request: Request, exc: AuctionModeratedError):
        status = exc.moderation_status
        detail = (
            "Product is moderated and cannot record interactions"
            if status == "MODERATED"
            else f"Product is {status} and cannot record interactions"
        )
        return JSONResponse(status_code=403, content={"detail": detail})

    @app.exception_handler(AuthenticationError)
    async def auth_error_handler(request: Request, exc: AuthenticationError):
        return JSONResponse(status_code=403, content={"detail": exc.message})

    @app.exception_handler(DuplicateEventConflictError)
    async def conflict_error_handler(request: Request, exc: DuplicateEventConflictError):
        return JSONResponse(status_code=409, content={"detail": exc.message})

    @app.exception_handler(ServiceUnavailableError)
    async def service_unavailable_handler(request: Request, exc: ServiceUnavailableError):
        return JSONResponse(status_code=503, content={"detail": exc.reason})

    @app.exception_handler(DuplicateKeyError)
    async def duplicate_key_error_handler(request: Request, exc: DuplicateKeyError):
        return JSONResponse(
            status_code=500,
            content={"detail": "Database constraint violation during persistence"},
        )
