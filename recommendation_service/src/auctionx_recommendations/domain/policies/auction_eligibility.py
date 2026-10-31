"""
Auction Eligibility & Lifecycle Resolution Policies.
Centralizes business governance, moderation gates, date parsing across both canonical
and legacy schemas, and strict fail-closed invariants for live auction eligibility.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional


def parse_iso_or_legacy_date(date_raw: Any, time_raw: Any = None) -> Optional[datetime]:
    """
    Timezone-safe parser supporting:
    - Python datetime objects
    - ISO 8601 strings (e.g. '2025-01-23T18:14:00.000Z')
    - Legacy HH:MM strings combined with date strings/objects
    Always returns UTC datetime or None if malformed.
    """
    if isinstance(date_raw, datetime):
        if date_raw.tzinfo is None:
            return date_raw.replace(tzinfo=timezone.utc)
        return date_raw.astimezone(timezone.utc)

    # 1. Check if time_raw is already a full ISO timestamp
    if isinstance(time_raw, str) and "T" in time_raw:
        try:
            cleaned = time_raw.strip().replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass

    # 2. If time_raw is a legacy "HH:MM" or "HH:MM:SS" string, extract date_part from date_raw and combine
    date_part_str = None
    if isinstance(date_raw, str):
        date_part_str = date_raw.split("T")[0].strip()
    elif isinstance(date_raw, datetime):
        date_part_str = date_raw.strftime("%Y-%m-%d")

    if date_part_str and isinstance(time_raw, str) and ":" in time_raw:
        clean_time = time_raw.strip()
        if len(clean_time) == 5:  # "HH:MM"
            clean_time = f"{clean_time}:00"
        try:
            combined_iso = f"{date_part_str}T{clean_time}+00:00"
            return datetime.fromisoformat(combined_iso)
        except Exception:
            pass

    # 3. Check if date_raw is an ISO timestamp
    if isinstance(date_raw, str) and "T" in date_raw:
        try:
            cleaned = date_raw.strip().replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass

    # 4. Fallback: Parse date_raw directly
    if isinstance(date_raw, str) and date_raw.strip():
        try:
            dt = datetime.fromisoformat(date_raw.strip().replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass

    return None


def resolve_auction_lifecycle(product: Dict[str, Any], now: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Authoritative Auction Lifecycle Resolver.
    Respects schema fields across both canonical (startTime/endTime) and legacy (biddingStartTime/biddingEndTime).

    States:
    - 'LIVE': Unmoderated, current time is between start and end time.
    - 'UPCOMING': Unmoderated, current time is before start time.
    - 'ENDED': Past end time, or explicitly marked Closed/ENDED/SETTLED/CANCELLED.
    - 'INELIGIBLE': Moderated, suspended, removed, or missing mandatory fields.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    # 1. Moderation & Catalog Governance check (Hard Invariant)
    if product.get("isModerated") is True:
        return {"status": "INELIGIBLE", "reason": "MODERATED"}

    moderation_status = str(product.get("moderationStatus", "ACTIVE")).upper()
    if moderation_status in ("REMOVED", "SUSPENDED", "FLAGGED"):
        return {"status": "INELIGIBLE", "reason": f"MODERATION_{moderation_status}"}

    raw_status = str(product.get("status", "Active")).strip()
    if raw_status in ("Closed", "ENDED", "SETTLED", "UNSOLD", "CANCELLED"):
        return {"status": "ENDED", "reason": f"STATUS_{raw_status.upper()}"}

    # 2. Resolve start time
    start_dt = parse_iso_or_legacy_date(
        product.get("startTime") or product.get("biddingStartDate"),
        product.get("startTime") or product.get("biddingStartTime"),
    )

    # 3. Resolve end time
    end_dt = parse_iso_or_legacy_date(
        product.get("endTime") or product.get("biddingEndTime") or product.get("bidEndTime")
    )

    # =========================================================================
    # Policy 1: Scheduled / Upcoming Listings
    # Listings before their scheduled start are UPCOMING, preserving listings
    # where the end-date schema is unfinalized or differently structured.
    # =========================================================================
    if start_dt and now < start_dt:
        return {
            "status": "UPCOMING",
            "reason": "BEFORE_START_TIME",
            "start": start_dt,
            "end": end_dt,
            "seconds_to_start": (start_dt - now).total_seconds(),
            "data_quality_warning": "MISSING_END_TIME" if end_dt is None else None,
        }

    if raw_status in ("SCHEDULED", "DRAFT"):
        return {
            "status": "UPCOMING",
            "reason": f"STATUS_{raw_status}",
            "start": start_dt,
            "end": end_dt,
            "seconds_to_start": (start_dt - now).total_seconds() if start_dt else None,
            "data_quality_warning": "MISSING_END_TIME" if end_dt is None else None,
        }

    # =========================================================================
    # Policy 2: Live Auction Policy (Strict Fail-Closed Invariant)
    # An auction whose start time has arrived (or has no start time) CANNOT be
    # LIVE without a verified, parseable future end time. Missing end time
    # immediately fails closed as INELIGIBLE to prevent zombie bidding.
    # =========================================================================
    if end_dt is None:
        return {
            "status": "INELIGIBLE",
            "reason": "MISSING_OR_MALFORMED_END_TIME",
            "data_quality_issue": True,
        }

    if now >= end_dt:
        return {"status": "ENDED", "reason": "PAST_END_TIME", "start": start_dt, "end": end_dt}

    if raw_status in ("Active", "LIVE"):
        seconds_remaining = (end_dt - now).total_seconds()
        return {
            "status": "LIVE",
            "start": start_dt,
            "end": end_dt,
            "seconds_remaining": seconds_remaining,
        }

    return {"status": "INELIGIBLE", "reason": f"UNKNOWN_STATUS_{raw_status}"}
