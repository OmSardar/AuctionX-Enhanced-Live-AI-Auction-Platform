"""
Auction lifecycle and catalog domain entities.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class AuctionLifecycleStatus(str, Enum):
    """Canonical lifecycle states for catalog items in the recommendation funnel."""

    LIVE = "LIVE"
    UPCOMING = "UPCOMING"
    ENDED = "ENDED"
    INELIGIBLE = "INELIGIBLE"


@dataclass(frozen=True)
class AuctionLifecycleInfo:
    """Encapsulates the resolved lifecycle state and timing parameters for an auction."""

    status: AuctionLifecycleStatus
    reason: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    seconds_remaining: Optional[float] = None
    seconds_to_start: Optional[float] = None
    data_quality_warning: Optional[str] = None
    data_quality_issue: bool = False

    @property
    def is_eligible_for_ranking(self) -> bool:
        """Determines if the auction can be surfaced in recommended candidate sets."""
        return self.status in (AuctionLifecycleStatus.LIVE, AuctionLifecycleStatus.UPCOMING)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation matching existing contract."""
        res: Dict[str, Any] = {"status": self.status.value}
        if self.reason:
            res["reason"] = self.reason
        if self.start:
            res["start"] = self.start
        if self.end:
            res["end"] = self.end
        if self.seconds_remaining is not None:
            res["seconds_remaining"] = self.seconds_remaining
        if self.seconds_to_start is not None:
            res["seconds_to_start"] = self.seconds_to_start
        if self.data_quality_warning:
            res["data_quality_warning"] = self.data_quality_warning
        if self.data_quality_issue:
            res["data_quality_issue"] = True
        return res
