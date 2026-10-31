"""
Internal service key authentication and authorization barrier.
Protects privileged endpoints and authoritative event telemetry using constant-time secret comparison.
"""

import hmac
import os
import sys
from typing import Optional

from ..config.settings import detect_is_testing


def verify_internal_service_key(
    incoming_key: Optional[str],
    configured_key: Optional[str] = None,
    environment: Optional[str] = None,
) -> bool:
    """
    Validates the internal service key header against the configured secret.
    Uses constant-time comparison to protect against timing side-channel attacks.
    """
    if not incoming_key:
        return False

    env = environment or os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development")).strip().lower()
    is_testing = detect_is_testing(env)

    target_key = configured_key if configured_key is not None else os.getenv("INTERNAL_SERVICE_KEY", "").strip()

    if target_key and hmac.compare_digest(incoming_key, target_key):
        return True

    if is_testing and hmac.compare_digest(incoming_key, "test_internal_auctionx_secret_key"):
        return True

    return False
