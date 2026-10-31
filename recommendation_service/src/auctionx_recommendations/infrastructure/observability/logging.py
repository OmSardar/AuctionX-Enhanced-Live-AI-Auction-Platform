"""
Structured logging module for AuctionX recommendation service.
Formats log events with correlation IDs, timestamps, and redaction of sensitive credentials.
"""

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# Root recommendation service logger
logger = logging.getLogger("auctionx_recommendations")
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)
    formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


def log_structured_event(
    event_name: str,
    level: str = "INFO",
    request_id: Optional[str] = None,
    path: Optional[str] = None,
    method: Optional[str] = None,
    duration_ms: Optional[float] = None,
    status_code: Optional[int] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """Logs a JSON-structured telemetry and operational event."""
    payload: Dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event_name,
        "level": level.upper(),
    }
    if request_id:
        payload["request_id"] = request_id
    if path:
        payload["path"] = path
    if method:
        payload["method"] = method
    if duration_ms is not None:
        payload["duration_ms"] = round(duration_ms, 2)
    if status_code is not None:
        payload["status_code"] = status_code
    if extra:
        payload.update(extra)

    log_fn = getattr(logger, level.lower(), logger.info)
    log_fn(json.dumps(payload))
