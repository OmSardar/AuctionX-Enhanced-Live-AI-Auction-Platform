# AuctionX — Public Documentation Allowlist and Release Exclusion Plan

## Document Metadata
- Document Type: Internal Operations Governance Plan
- Date: October 2026
- Status: Proposed for Repository Owner Approval
- Target Public Repository: `https://github.com/OmSardar/AuctionX-Enhanced-Live-AI-Auction-Platform.git`

---

## 1. Executive Summary

This plan defines the public documentation allowlist and the internal audit exclusion protocol for AuctionX. The repository owner has established that dated internal audit reports, security vulnerability assessments, quarantine manifests, and implementation evidence must be preserved privately for engineering history but excluded from the intended public GitHub release.

This document identifies:
1. The intended public documentation allowlist.
2. The internal paths and artifacts that must not be published.
3. The tracking and staging status in the current Git index.
4. The structural conflict between the current Git index and the publication requirement.
5. The exact, non-destructive procedure required to export or publish a clean public release branch without deleting local files or modifying historical branches.

---

## 2. Intended Public Documentation Allowlist

The public release should include only files that materially help technical reviewers, recruiters, developers, and prospective contributors understand, evaluate, run, and test AuctionX.

The recommended public documentation candidates are:

| File / Directory Path | Classification | Public Justification |
| :--- | :--- | :--- |
| `README.md` | Public Core | Authoritative technical overview, architecture diagrams, subsystem deep dives, local setup guide, and test matrix. |
| `docs/licenses/THIRD_PARTY_NOTICES.md` | Public Legal | Complete inventory of third-party dependencies, open-source licenses, and copyright notices required for compliance. |
| `docs/architecture/system-overview.md` | Public Reference | Supporting architectural document detailing high-level component boundaries and data flows. |
| `docs/architecture/high-level-design.md` | Public Reference | High-level system topology, non-functional requirements, and service interaction models. |
| `docs/architecture/low-level-design.md` | Public Reference | Schema designs, controller contracts, and concurrency models. |
| `docs/architecture/architecture-decisions.md` | Public Reference | Architecture Decision Records (ADRs) explaining technical trade-offs (e.g. CAS bidding, outbox telemetry). |
| `docs/architecture/frontend-design-system.md` | Public Reference | Documentation of design tokens, CSS variables, and accessibility conventions. |
| `docs/api/api-overview.md` | Public Reference | Comprehensive HTTP and WebSocket endpoint catalog. |
| `docs/api/authentication.md` | Public Reference | Public specification of JWT session cookies, CSRF tokens, and RBAC middleware. |
| `docs/development/local-setup.md` | Public Developer | Multi-service installation and workstation setup instructions. |
| `docs/development/conventions.md` | Public Developer | Code style guidelines, linting conventions, and commit formatting. |
| `docs/development/contributing.md` | Public Developer | Contributor pull request requirements and verification steps. |
| `docs/security/threat-model.md` | Public Security | High-level architectural threat model (STRIDE analysis) describing mitigations without exposing internal exploits. |
| `docs/security/security-controls.md` | Public Security | Defensive controls inventory (CSRF, Helmet, rate limiters, input sanitization). |
| `docs/operations/environment-configuration.md` | Public Operations | Variable dictionary and setup guide for `.env.example` templates. |
| `docs/operations/deployment-and-rollback.md` | Public Operations | Production container build and NGINX ingress deployment architecture. |
| `docs/testing/test-strategy.md` | Public QA | Testing pyramid methodology and verification commands. |
| `docs/testing/e2e-testing-guide.md` | Public QA | Guide for running Playwright browser automation tests. |

---

## 3. Internal Material Exclusion Denylist

The following directories, files, and patterns must remain private and must not be published to the public GitHub repository:

| Path / Pattern | Classification | Rationale for Exclusion |
| :--- | :--- | :--- |
| `docs/audits/` (all 89 audit files) | Internal QA Evidence | Internal security audits, test walkthroughs, regression logs, and dated verification memos intended solely for private review. |
| `docs/audits/frontend/` (18 files) | Internal QA Evidence | Historical frontend layout and component audit reports. |
| `docs/audits/README.md` | Internal Index | Master index of internal audit reports. |
| `docs/operations/public-release-documentation-plan.md` | Internal Governance | This operational governance document. |
| `scratch/` | Temporary Artifacts | Local development scratchpad scripts, temporary test harnesses, and logs. |
| `.env` / `.env.*.local` | Sensitive Credentials | Environment variable instances containing developer secrets or local keys. |
| `client/src/assets/images/...` (22 quarantined assets) | Quarantined Media | Visual assets isolated pending formal copyright verification and legal sign-off. |

---

## 4. Current Git Tracking and Staging Analysis

An inspection of the local Git repository reveals a critical structural condition:

### A. Currently Staged Renames (Git Index)
- Exactly 27 files are staged in the Git index as renames (`R100`).
- Of these 27 staged files, **18 files are located in `docs/audits/frontend/`**:
  - `docs/audits/frontend/frontend-audit.md`
  - `docs/audits/frontend/global-design-consistency-audit.md`
  - `docs/audits/frontend/phase-2-execution-report.md` through `phase-5e-final-audit-report.md`
  - `docs/audits/frontend/post-phase-5e-regression-report.md`
- The remaining 9 staged files belong to `docs/architecture/` (8 files) and `docs/testing/` (1 file).

### B. Tracked Files in `docs/audits/`
- Running `git ls-files docs/audits/` confirms that **50 audit documents** are currently tracked by Git on the active working branch.
- Additionally, newly numbered audit documents (`Audit-001` through `Audit-089`) are untracked in the working tree.

### C. The Git Tracking Invariant Conflict
- **Important Principle:** Adding `docs/audits/` or `*.md` to `.gitignore` does NOT prevent files that are already tracked or staged from being committed or pushed. Git ignores `.gitignore` rules for any file already present in the index.
- **The Conflict:** If a committer runs `git commit` and pushes the current branch to a public remote, all 50 tracked audit files and all 18 staged frontend audit files will be pushed to the public GitHub repository, violating the owner's explicit publication requirement.

---

## 5. Safe, Non-Destructive Next Action Protocol

To achieve a clean, audit-free public release without modifying the private working branch, deleting local files, or losing Git history, the repository owner should execute the following controlled procedure.

### Recommended Strategy: Dedicated Public Release Branch

```bash
# Step 1: Ensure current working branch is clean and preserved
# (Do NOT reset, clean, or discard any local changes on the working branch)

# Step 2: Create a dedicated release preparation branch from the current HEAD
git checkout -b release/public-v2.0.0

# Step 3: Remove internal audit documentation from Git tracking on this release branch ONLY
# The '--cached' flag removes files from the Git index while keeping local files on disk 100% intact
git rm -r --cached docs/audits/
git rm -r --cached scratch/

# Step 4: Add docs/audits/ and scratch/ to .gitignore on the release branch
echo "docs/audits/" >> .gitignore
echo "scratch/" >> .gitignore
git add .gitignore

# Step 5: Verify that zero audit files remain in the staged release index
git ls-files docs/audits/
# (Output should be empty)

# Step 6: Review staged status on the release branch
git status --short

# Step 7: Commit the sanitized public release tree
git commit -m "chore(release): prepare sanitized public repository release"

# Step 8: Push exclusively the sanitized release branch to the public remote
git push public release/public-v2.0.0:main
```

### Alternative Strategy: Clean Export via `git archive`
If the owner prefers never to have audit paths present even in the initial Git commit history of the public repository:
1. Export the allowlisted files to a clean directory using `git archive` or a sparse checkout script.
2. Initialize a fresh Git repository in the exported directory.
3. Commit the allowlisted files as the initial public commit (`v2.0.0 Initial Public Release`).
4. Push to the public repository `https://github.com/OmSardar/AuctionX-Enhanced-Live-AI-Auction-Platform.git`.

---

## 6. Pre-Publication Verification Checklist

Prior to publishing the public branch, verify:
- [ ] `git ls-files docs/audits/` returns zero files on the public branch.
- [ ] Root `README.md` contains zero links to `docs/audits/`.
- [ ] No `.env` files or credentials exist in the Git index (`git ls-files | grep '\.env$'`).
- [ ] The 22 quarantined visual assets are excluded from the public assets tree.
- [ ] The root `LICENSE` text is formally approved by the copyright holder.
- [ ] `docs/licenses/THIRD_PARTY_NOTICES.md` is verified against current dependency manifests.
