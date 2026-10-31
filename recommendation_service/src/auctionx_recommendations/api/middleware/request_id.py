"""
Request correlation and ID propagation middleware.
"""

import re
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

CORRELATION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{8,64}$")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Sanitizes incoming correlation IDs or generates fresh UUIDv4 per request."""

    async def dispatch(self, request: Request, call_next) -> Response:
        raw_id = request.headers.get("X-Request-ID") or request.headers.get("X-Correlation-ID")
        if raw_id and CORRELATION_ID_PATTERN.match(raw_id.strip()):
            req_id = raw_id.strip()
        else:
            req_id = str(uuid.uuid4())

        request.state.request_id = req_id
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = req_id
        response.headers["X-Correlation-ID"] = req_id
        return response
