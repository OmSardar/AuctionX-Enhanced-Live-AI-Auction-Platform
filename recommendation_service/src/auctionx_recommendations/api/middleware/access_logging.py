"""
Access logging and operational metrics middleware.
"""

import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ...infrastructure.observability.logging import log_structured_event
from ...infrastructure.observability.metrics import metrics


class AccessLoggingMiddleware(BaseHTTPMiddleware):
    """Logs incoming HTTP requests with latency and status code, and records operational metrics."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()
        req_id = getattr(request.state, "request_id", None) or request.headers.get("X-Request-ID")

        response: Response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000.0

        # Record operational metrics
        metrics.increment("http_requests_total")
        metrics.increment(f"http_status_{response.status_code}")
        metrics.record_duration("http_request_duration_ms", duration_ms)

        # Avoid polluting logs with rapid health check spam unless degraded
        if request.url.path in ("/health", "/api/health", "/metrics", "/api/metrics") and response.status_code == 200:
            return response

        log_structured_event(
            event_name="http_request",
            level="INFO" if response.status_code < 400 else ("WARNING" if response.status_code < 500 else "ERROR"),
            request_id=req_id,
            path=request.url.path,
            method=request.method,
            duration_ms=duration_ms,
            status_code=response.status_code,
        )
        return response
