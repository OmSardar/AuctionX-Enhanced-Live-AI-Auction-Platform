# ADR 0003: Backward-Compatibility Facades for Legacy Imports and Test Monkeypatching

## Status
Accepted

## Context
The AuctionX recommendation service was originally deployed and tested using flat root-level modules: `main.py`, `ranking.py`, and `evaluation.py`.
The parent Express backend, container entry points (`uvicorn main:app`), CI test runners (`pytest`), and the comprehensive existing test suite (`tests/test_recommendations.py`, `test_cors_regression.py`) import these root modules directly.
Crucially, legacy tests heavily employ unittest monkeypatching targeting module-level variables (e.g., `patch("main.db", mock_db)`, `patch("main.redis_client", None)`, `patch("main.INTERNAL_SERVICE_KEY", "test-key")`).
Relocating all logic strictly into `src/auctionx_recommendations/` without root entry points would break:
1. Container startup commands (`uvicorn main:app --host 0.0.0.0 --port 8000`).
2. Existing CI workflows executing `pytest` from `recommendation_service/`.
3. Legacy tests relying on `main.db`, `main.redis_client`, and `ranking.*` exports.

## Decision
Maintain root-level `main.py`, `ranking.py`, and `evaluation.py` as high-fidelity compatibility facades:
1. **`main.py` Facade**:
   - Exposes `app = create_app()` for ASGI servers.
   - Re-exports module-level compatibility variables `db`, `redis_client`, `INTERNAL_SERVICE_KEY`, and facade helpers (`compute_recommendations`, `build_redis_client`, `compute_pseudonymous_user_id`).
   - Employs dynamic dependency resolution hooks in `auctionx_recommendations.api.dependencies` that inspect `sys.modules["main"]` during request dependency injection. This eliminates route duplication while guaranteeing that test patches applied to `main` immediately take effect in use-case execution without altering legacy test files.
2. **`ranking.py` Facade**:
   - Re-exports domain symbols: `rank_auctions`, `calculate_features`, `is_auction_eligible`, `FEATURE_WEIGHTS`, `DEFAULT_FEATURE_WEIGHTS`, `calculate_category_affinity`, `calculate_collaborative_score`, `calculate_popularity_score`, `calculate_freshness_score`, `calculate_urgency_score`.
3. **`evaluation.py` Facade**:
   - Re-exports evaluation symbols: `precision_at_k`, `recall_at_k`, `ndcg_at_k`, `graded_ndcg_at_k`, `category_diversity_score`, `evaluate_ranking_dataset`, `OfflineEvaluator`.

## Consequences
- **Positive**:
  - 100% backward compatibility: all 68 baseline tests and 5 CORS tests run and pass without modifying a single line of legacy test code.
  - Zero deployment friction: Dockerfile, Compose files, and scripts continue to execute without needing startup flag migrations.
  - Clean separation: New code can import modern domain and application abstractions directly from `auctionx_recommendations.*`.
- **Negative**:
  - Two entry points exist for the service until legacy tests and configurations are permanently transitioned in a future major version.
