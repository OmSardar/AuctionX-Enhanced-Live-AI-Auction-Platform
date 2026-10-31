"""
Interaction telemetry application service.
Facade over interaction tracking use cases.
"""

from typing import Any, Dict, List, Optional
from ..use_cases.record_interactions import RecordInteractionsUseCase


class InteractionService:
    """Application service for telemetry recording and ingestion."""

    def __init__(self, record_interactions_uc: RecordInteractionsUseCase):
        self.record_interactions_uc = record_interactions_uc

    def record_single(
        self,
        interaction_dict: Dict[str, Any],
        incoming_service_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self.record_interactions_uc.execute_single(
            interaction_dict=interaction_dict,
            incoming_service_key=incoming_service_key,
        )

    def record_batch(
        self,
        interactions: List[Dict[str, Any]],
        incoming_service_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self.record_interactions_uc.execute_batch(
            interactions=interactions,
            incoming_service_key=incoming_service_key,
        )
