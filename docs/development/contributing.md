# AuctionX — Contributor Workflow & Release Policy

> **Document Classification:** Community & Team Collaboration  
> **Status:** Active / Normative  
> **Last Verified:** October 2026  

---

## 1. Public Release & Repository Policy

The official public repository for AuctionX is:
- **Repository:** `https://github.com/OmSardar/AuctionX-Enhanced-Live-AI-Auction-Platform.git`

### Standard Workflow
When contributing or promoting tested changes:

```bash
# Verify local branch is up to date
git checkout main
git pull origin main

# Create feature branch
git checkout -b feat/your-feature-name

# Run test and build validation
npm run test:unit --prefix server
npm run build --prefix client

# Push feature branch for pull request review
git push origin feat/your-feature-name
```

**Never force-push (`git push --force`) or rewrite published history on the `main` branch.**

---

## 2. Branching Strategy

- `main` — Production branch. Must always build, pass tests, and remain deployable.
- `feat/<feature-name>` — New capabilities or sub-features.
- `fix/<issue-name>` — Bug remediations and patch fixes.
- `docs/<topic-name>` — Documentation refactoring and runbook updates.

---

## 3. Pre-Commit Verification Checklist

Before creating a pull request or pushing to release, execute the following local verification steps:

1. **Verify No Trailing Whitespace:**
   ```bash
   git diff --check
   ```
2. **Run Backend Unit & Integration Tests:**
   ```bash
   npm test --prefix server -- tests/unit
   npm test --prefix server -- tests/integration/auth
   npm test --prefix server -- tests/integration/admin
   ```
3. **Run Recommendation Service Tests:**
   ```bash
   pytest recommendation_service/tests
   ```
4. **Validate Frontend Production Build:**
   ```bash
   npm run build --prefix client
   ```
5. **Verify No Secrets are Committed:**
   - Confirm `.env` files are untracked (`git status --short`).
   - Check that all example files contain only sanitized placeholders.

---

## 4. Conventional Commit Format

Commit messages should follow the Conventional Commits specification:

```
<type>(<scope>): <short description>

[optional body explaining rationale]

[optional footer(s)]
```

**Types:**
- `feat:` A new user-facing or administrative feature.
- `fix:` A bug remediation.
- `docs:` Documentation changes only.
- `refactor:` Code refactoring that neither fixes a bug nor adds a feature.
- `test:` Adding or updating tests.
- `chore:` Maintenance tasks, dependency updates, or build script tweaks.
