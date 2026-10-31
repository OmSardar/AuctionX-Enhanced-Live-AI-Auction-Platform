# ADR 0001: Layered Modular Monolith Architecture for Recommendation Service

## Status
Accepted

## Context
The AuctionX recommendation service was initially implemented as a small collection of flat Python files (`main.py`, `ranking.py`, `evaluation.py`). While functional, mixing database queries, ranking calculations, HTTP serialization, and authentication in single procedural functions made unit testing difficult, increased coupling with MongoDB, and prevented isolated testing of ranking policies.

## Decision
Refactor the service into a **domain-centric, layered modular architecture** located in `src/auctionx_recommendations/`:
1. **Domain Layer**: Contains pure business rules, canonical date parsing, auction lifecycle policies, normalized scoring, and diversity filtering. Zero external framework dependencies.
2. **Application Layer**: Contains use cases (`GetRecommendationsUseCase`, `RecordInteractionsUseCase`) and abstract repository/cache ports (`AuctionRepository`, `InteractionRepository`, `CachePort`).
3. **Infrastructure Layer**: Contains concrete adapters for PyMongo, Redis, constant-time security authentication, and typed configuration.
4. **Transport Layer**: Contains FastAPI routers, Pydantic schemas, dependency injection providers, and middleware.

## Consequences
- **Positive**:
  - Domain ranking logic can be unit tested in isolation without spinning up MongoDB or Redis mocks.
  - Clear architectural boundaries allow future storage or cache migrations without touching ranking policies.
  - Zero performance regression or latency overhead.
- **Negative**:
  - More files and explicit port interfaces to maintain.
