# AuctionX — Documentation Index

Welcome to the **AuctionX** documentation hub. This repository contains the complete technical architecture, operational runbooks, API specifications, security models, and testing strategies for the AuctionX real-time auction platform.

All documentation is organized into clear functional areas to separate normative design and guides from historical audit records.

---

## Documentation Map

```
docs/
├── architecture/     # System context, component designs, and architectural decision records
├── development/      # Local setup, coding conventions, and contributor workflows
├── api/              # API contracts, routing catalogs, and authentication specifications
├── security/         # Threat models, security controls, and defensive policies
├── operations/       # Deployment runbooks, environment configuration, and rollback guides
├── testing/          # Testing pyramid, test strategies, and Playwright E2E execution
└── audits/           # Dated verification evidence, hardening audits, and frontend reports
```

---

## 1. Architecture & System Design (`docs/architecture/`)

Normative documentation defining system topology, service interactions, data ownership, and component designs.

| Document | Purpose |
| :--- | :--- |
| [System Overview](./architecture/system-overview.md) | High-level architecture, component boundaries, data stores, and cross-cutting concerns. |
| [System Flows](./architecture/system-flows.md) | Sequence diagrams and step-by-step lifecycles for user authentication, live bidding, and payment settlement. |
| [High-Level Design](./architecture/high-level-design.md) | System context, non-functional requirements, data storage topology, and scalability considerations. |
| [Low-Level Design](./architecture/low-level-design.md) | Controller, service, and schema specifications, state machines, and concurrency controls. |
| [Architecture Decisions](./architecture/architecture-decisions.md) | Global Architecture Decision Records (ADRs) covering state management, CAS bidding, and outbox telemetry. |
| [Implementation Roadmap](./architecture/implementation-roadmap.md) | Multi-phase development roadmap and system delivery milestones. |
| [Design Verification](./architecture/design-verification.md) | Structural verification matrix comparing design invariants against source code. |
| [Frontend Design System](./architecture/frontend-design-system.md) | Tokenized UI styling, theme architecture, dark mode, and component library conventions. |
| [ADR: Design Tokens](./architecture/adr/0001-design-tokens-and-theme-architecture.md) | Frontend architectural decision on CSS variable tokens and theme persistence. |

---

## 2. Developer Guide (`docs/development/`)

Resources for engineers building, maintaining, and contributing to AuctionX.

| Document | Purpose |
| :--- | :--- |
| [Local Setup](./development/local-setup.md) | Step-by-step local workstation setup with Node.js, Python, MongoDB, Redis, or Docker Compose. |
| [Conventions](./development/conventions.md) | Coding standards, linting, error response formats, Git commit rules, and security guidelines. |
| [Contributing Guide](./development/contributing.md) | Contributor workflows, pull request requirements, and release verification safeguards. |

---

## 3. API & Authentication (`docs/api/`)

HTTP and WebSocket interfaces exposed by AuctionX backend services.

| Document | Purpose |
| :--- | :--- |
| [API Overview](./api/api-overview.md) | Complete endpoint catalog across Products, Auctions, Bidding, Orders, Payments, and Admin operations. |
| [Authentication & Authorization](./api/authentication.md) | JWT cookie sessions, Google OAuth 2.0 flow, RBAC policies, and role-based route middleware. |

---

## 4. Security & Compliance (`docs/security/`)

Security governance, threat models, and vulnerability mitigations.

| Document | Purpose |
| :--- | :--- |
| [Threat Model](./security/threat-model.md) | STRIDE-based threat assessment covering auction snipers, payment tampering, and IDOR vulnerabilities. |
| [Security Controls](./security/security-controls.md) | Implemented security defenses: CSRF protection, rate limiters, Helmet headers, HMAC signatures, and audit logs. |

---

## 5. Operations & Deployment (`docs/operations/`)

Infrastructure management, cloud deployments, and runtime runbooks.

| Document | Purpose |
| :--- | :--- |
| [Environment Configuration](./operations/environment-configuration.md) | Variable definitions, sensitive credential boundaries, and configuration matrices for all services. |
| [Deployment & Rollback](./operations/deployment-and-rollback.md) | Render PaaS CD deployment, Docker Compose production orchestration, pre-flight gates, and rollback plans. |
| [Staging Deployment Runbook](./operations/staging-deployment-runbook.md) | Isolated cloud staging deployment procedure with strict, allowlisted guarded cleanup routines. |
| [Nginx Reverse Proxy Guide](./operations/nginx-reverse-proxy-guide.md) | Single public origin reverse proxy architecture, SSL termination, and private networking. |
| [SDLC & Observability Readiness](./operations/sdlc-devsecops-observability-readiness.md) | DevSecOps maturity matrix, Prometheus telemetry, and observability standards. |
| [Public Release Documentation Plan](./operations/public-release-documentation-plan.md) | Public release documentation governance, publication allowlist, and license compliance. |

---

## 6. Testing & Quality Assurance (`docs/testing/`)

Validation strategies, test suites, and browser automation.

| Document | Purpose |
| :--- | :--- |
| [Test Strategy](./testing/test-strategy.md) | Testing pyramid: unit, integration, smoke, graybox, acceptance, and load tests. |
| [E2E Testing Guide](./testing/e2e-testing-guide.md) | Playwright browser automation suite, authentication mocking, and CI integration. |

---

## 7. Historical Audits & Verification Evidence (`docs/audits/`)

The repository maintains an authoritative, continuous audit sequence ([Audit Index](./audits/README.md)) documenting verification evidence, security hardening, and architecture milestones from project inception to public release:

- **Authoritative Audit Index:** [Complete Audit Index (Audit-001 through Audit-092)](./audits/README.md)
- **Architecture & Baseline (`Audit-001` – `Audit-003`):** Implementation plans, testing walkthroughs, and initial security validations.
- **Bidding Engine & Real-Time Lifecycle (`Audit-004` – `Audit-014`):** CAS atomic bidding correctness, WebSocket timing, and synthesized Web Audio diagnostics.
- **Frontend Refactoring & Design System (`Audit-015` – `Audit-034`):** Phase 2 through Phase 5E component library audits, layout hardening, and design token consistency.
- **Payments & Wallet Settlement (`Audit-035` – `Audit-046`):** Razorpay outbox pattern, paise-precision calculation, crash safety, and cross-document settlement invariants.
- **Integration, Staging & Recommendation (`Audit-047` – `Audit-050`):** End-to-end integration, staging validation gates, and recommendation service readiness.
- **Public Release Hardening & Media Security (`Audit-051` – `Audit-085`):** Gitleaks CI baselines, GPL removal, local vector asset rights, and `sharp` image sanitization pipelines.
- **Release Consolidation & Publication Governance (`Audit-086` – `Audit-087`):** Public release consolidation report and owner decision checklist.
- **Release Governance & Interoperability (`Audit-088` – `Audit-092`):** Final release gates, Cloudflare review, security findings closure, network protocols, and web service interoperability audits.

