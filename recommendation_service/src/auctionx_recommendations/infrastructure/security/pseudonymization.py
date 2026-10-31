"""
Cryptographic pseudonymization adapter.
Generates deterministic, pseudonymous user identifiers using keyed HMAC-SHA256
to protect PII in telemetry pipelines and machine learning datasets.
"""

import hashlib
import hmac
import os
import sys
from typing import Optional

_hmac_fallback_warned = False


def compute_pseudonymous_user_id(email: str, explicit_secret: Optional[str] = None) -> str:
    """
    Computes a deterministic, pseudonymous user identifier using keyed HMAC-SHA256.
    Protects user PII in telemetry pipelines and machine learning datasets while
    maintaining cross-session identity consistency for authenticated users.
    """
    global _hmac_fallback_warned

    if explicit_secret is not None and explicit_secret.strip():
        secret = explicit_secret.strip()
    else:
        dedicated = os.getenv("RECOMMENDATION_HMAC_SECRET", "").strip()
        if not dedicated and not _hmac_fallback_warned:
            print(
                "[SECURITY WARNING] RECOMMENDATION_HMAC_SECRET is not configured in environment. "
                "Falling back to secondary secret or development default.",
                file=sys.stderr,
            )
            _hmac_fallback_warned = True

        secret = (
            dedicated
            or os.getenv("JWT_SECRET", "").strip()
            or "auctionx_telemetry_pseudonym_secret"
        )

    clean = email.strip().lower()
    return hmac.new(secret.encode("utf-8"), clean.encode("utf-8"), hashlib.sha256).hexdigest()
