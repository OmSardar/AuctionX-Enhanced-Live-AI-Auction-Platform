# ADR 0002: Keyed HMAC-SHA256 User Pseudonymization for Telemetry Privacy

## Status
Accepted

## Context
Recommendation engines require user tracking across sessions to compute affinity profiles and collaborative filtering. Storing raw user email addresses or direct PII in interaction collections poses significant security and compliance risks (GDPR, CCPA).

## Decision
All user interaction records compute a deterministic pseudonymous identifier via keyed `HMAC-SHA256(RECOMMENDATION_HMAC_SECRET, email.strip().lower())`.
- Raw email addresses are never required for downstream ranking computations once transformed into pseudonyms.
- The HMAC key is independently configured (`RECOMMENDATION_HMAC_SECRET`) from service-to-service authentication keys (`INTERNAL_SERVICE_KEY`).
- Secret rotation allows preserving interaction histories or isolating different environment stages.

## Consequences
- **Positive**:
  - Customer PII is protected across telemetry logs, database collections, and offline evaluation datasets.
  - Consistent cross-session affinity calculations remain deterministic.
- **Negative**:
  - Secret loss prevents correlating historical interaction events with future user sessions.
