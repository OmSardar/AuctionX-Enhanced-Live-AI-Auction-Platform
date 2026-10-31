"""
Ranking feature weights and constants.
"""

from typing import Dict

# Configurable & documented ranking weights (summing to 1.0)
DEFAULT_RANKING_WEIGHTS: Dict[str, float] = {
    "category_affinity": 0.35,
    "collaborative": 0.25,
    "popularity": 0.15,
    "freshness": 0.15,
    "urgency": 0.10,
}

# Interaction action weights reflecting user intent strength
INTERACTION_WEIGHTS: Dict[str, float] = {
    "purchase": 10.0,
    "bid": 5.0,
    "click": 2.0,
    "view": 1.0,
    "impression": 0.0,
}
