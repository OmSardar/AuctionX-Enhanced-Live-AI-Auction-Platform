# Testing Documentation & Strategy
Comprehensive testing strategy and guides for AuctionX Server.
See root testing documentation in [TESTING.md](../../../TESTING.md).

## Test Organization
- `tests/unit/`: Domain unit tests for controllers, services, utilities, and validation.
- `tests/integration/`: End-to-end service integration and Supertest endpoint assertions.
- `tests/smoke/`: Rapid verification of core platform availability and critical paths.
- `tests/performance/`: Latency and concurrent bidding throughput benchmarks.
- `tests/load/`: Simulated traffic and heavy load evaluations.
