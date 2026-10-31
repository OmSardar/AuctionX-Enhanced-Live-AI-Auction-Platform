# Stage 7.13: Proprietary Licensing Change Plan and Owner Approval Gate

> **Document Type:** Implementation Plan & Owner Decision Gate  
> **Status:** **`AWAITING OWNER APPROVAL — NO LICENSING CHANGES APPLIED`**  
> **Target Release:** AuctionX — Public Source-Available Repository Release  
> **Preceding Audits:**  
> - [Stage 7.7: Proprietary Licensing Proposal](Audit-057-Proprietary-Licensing-And-Policy-Proposal.md)  
> - [Stage 7.8: Proprietary License Proposal Validation](Audit-058-Proprietary-License-Proposal-Validation.md)  
> - [Stage 7.10: Geodata Remediation Audit](Audit-060-Geodata-Dependency-Remediation.md)  
> - [Stage 7.11: Consolidated Release Blocker Audit](Audit-061-Consolidated-Public-Release-Blockers.md)  
> - [Stage 7.12: Licensing Consistency Audit](Audit-062-Licensing-Consistency-And-Release-Policy.md)  
> **Audit Date:** October 18, 2026  

---

## 1. Executive Summary

This document establishes a structured, non-destructive implementation plan to transition the AuctionX repository to the project owner's intended **Proprietary, Source-Available Licensing Model**.

In strict adherence to mandatory safety constraints:
- **No licensing, legal, manifest, or documentation changes were applied during this stage.**
- The untracked root [`LICENSE`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/LICENSE) file remains completely untouched.
- Package manifests, contribution documentation, security policies, and README files were **not modified**.
- All **27 staged documentation renames** and working tree changes remain intact in the Git index.
- Cloud deployment and database access were kept strictly separate and uninitiated.

This report provides the owner with an exact, file-by-file proposed change matrix, drafting and legal-review dependencies, an explicit decision checklist, and a validation plan. 

The final verdict is **`AWAITING OWNER APPROVAL — NO LICENSING CHANGES APPLIED`**.

---

## 2. Intended Licensing Model & Policy Baseline

The owner's licensing policy defines a proprietary, source-available project:
1. **Ownership Retention:** The owner retains full, exclusive proprietary ownership of the AuctionX codebase and intellectual property.
2. **Public Inspection Permitted:** The source code will be publicly visible on GitHub for technical inspection, security auditing, educational review, and portfolio evaluation.
3. **Controlled Community Contributions:** Third parties may submit issues and pull requests to the official repository. The maintainers retain absolute discretion to accept, reject, or modify any submission.
4. **Commercial & Redistribution Bar:** General permission to reuse, redistribute, host a competing SaaS, commercialize, or publish derivative versions outside the official repository is strictly prohibited.
5. **Inbound Contributor Licensing Model:** Contributors retain personal copyright authorship while granting the project owner a perpetual, irrevocable, worldwide, royalty-free, commercial, sublicensable license to use, modify, sublicense, and distribute their contributions under any licensing terms (including proprietary or closed-source commercial terms).
6. **Owner Prerogative:** Legal terms remain subject to owner approval and formal legal review.

---

## 3. Proposed Change Matrix by Category

The proposed changes are organized into six distinct functional categories. Each file modification is specified with exact current evidence, proposed changes, justification, approval requirements, and validation methods.

### Category 1: Root Proprietary License

| Parameter | Specification & Evidence |
| :--- | :--- |
| **File Path** | [`LICENSE`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/LICENSE) (Repository Root) |
| **Current State & Evidence** | 22 lines of standard MIT License text ([`LICENSE:L1-22`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/LICENSE#L1-L22)), copyright "2026 Om Sardar and AuctionX Contributors". Untracked file (`?? LICENSE`). |
| **Exact Proposed Modification** | Overwrite the entire file with the finalized **AuctionX Proprietary Source-Available License** (drafted in Stage 7.7 and hardened in Stage 7.8):<br/>- Copyright notice: `Copyright (c) [YYYY] [COPYRIGHT HOLDER]. All Rights Reserved.`<br/>- Section 1 (Limited Grant): Viewing, non-commercial local evaluation, security review, and GitHub platform PR submission.<br/>- Section 2 (Prohibitions): Explicit ban on commercial exploitation, SaaS/PaaS hosting, external redistribution, and independent derivative works.<br/>- Section 3–4: Disclaimers of warranty and liability limitations.<br/>- Section 5: Governing Law & Jurisdiction specifying `[Governing Jurisdiction / Country]`. |
| **Classification** | **Primary Legal Contract / Governing License** |
| **Why Needed** | Eliminates the critical contradiction where the repository currently grants an unrestricted open-source license to the public. Legally establishes proprietary rights and remedies. |
| **Required Owner Approvals** | 1. Legal Entity Name<br/>2. Copyright Year<br/>3. Governing Jurisdiction<br/>4. Explicit authorization to overwrite root `LICENSE` |
| **Validation Method** | `git diff LICENSE`, confirm zero references to MIT, confirm proprietary restrictions are present. |
| **Dependencies** | Owner Decisions #1, #2, #3, #7. |

---

### Category 2: README Licensing Notice and Badges

| Parameter | Specification & Evidence |
| :--- | :--- |
| **File Path** | [`README.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/README.md) |
| **Current State & Evidence** | Line 3: `[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)`<br/>Line 29: `- [License](#license)`<br/>Lines 253–255: `## License\nThis project is licensed under the [MIT License](LICENSE).` |
| **Exact Proposed Modification** | 1. Replace line 3 badge with:<br/>`[![License: Proprietary Source-Available](https://img.shields.io/badge/License-Proprietary%20Source--Available-red.svg)](LICENSE)`<br/>2. Replace lines 253–256 with:<br/>```markdown<br/>## License & Intellectual Property<br/><br/>Copyright (c) [YYYY] [COPYRIGHT HOLDER]. All Rights Reserved.<br/><br/>AuctionX is proprietary, source-available software. The source code is made publicly available solely for personal inspection, educational review, and submitting contributions to the official repository. All commercial use, hosted software-as-a-service (SaaS) operations, external redistribution, and independent derivative works are strictly prohibited without prior written authorization.<br/><br/>For complete legal terms, refer to the [AuctionX Proprietary Source-Available License](LICENSE).<br/>``` |
| **Classification** | **Public Documentation & Visual Signaling** |
| **Why Needed** | Removes misleading open-source badges that signal permissive licensing to search engines, GitHub crawlers, and visitors. |
| **Required Owner Approvals** | Approval of public notice text and badge design. |
| **Validation Method** | `git grep -i "MIT License" README.md` (must return 0 matches); markdown preview inspection. |
| **Dependencies** | Category 1 (Root License text finalized). |

---

### Category 3: Package-Manager Metadata

| Parameter | Specification & Evidence |
| :--- | :--- |
| **File Paths** | 1. [`server/package.json`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/package.json) & [`server/package-lock.json`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/package-lock.json)<br/>2. [`client/package.json`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/package.json) & [`client/package-lock.json`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/package-lock.json)<br/>3. [`recommendation_service/pyproject.toml`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/recommendation_service/pyproject.toml) |
| **Current State & Evidence** | - `server/package.json:L26-27`: `"author": "Invincibles"`, `"license": "ISC"`<br/>- `server/package-lock.json:L10`: locks `"license": "ISC"`<br/>- `client/package.json:L3`: `"private": true`, omits `"license"` field<br/>- `recommendation_service/pyproject.toml:L1-15`: omits `license` under `[project]` |
| **Exact Proposed Modification** | 1. In `server/package.json`:<br/>   - Set `"author": "[COPYRIGHT HOLDER]"`<br/>   - Set `"license": "UNLICENSED"`<br/>   - Add `"private": true`<br/>   - Run `npm install --package-lock-only` in `server/` to regenerate `server/package-lock.json`<br/>2. In `client/package.json`:<br/>   - Add `"license": "UNLICENSED"` directly after `"private": true`<br/>   - Run `npm install --package-lock-only` in `client/` to synchronize `client/package-lock.json`<br/>3. In `recommendation_service/pyproject.toml`:<br/>   - Under `[project]`, add: `license = { text = "Proprietary Source-Available" }` |
| **Classification** | **Technical Package-Manager Metadata (npm / pip PEP 621)** |
| **Why Needed** | Prevents accidental publishing of private microservices to public registries (`registry.npmjs.org` / PyPI); eliminates misleading ISC open-source metadata. |
| **Metadata vs. Legal Reality** | **Crucial Distinction:** Setting `"license": "UNLICENSED"` in `package.json` is a package-manager instruction to CLI tooling. It does **not** create an enforceable contract with human users and does not replace the root [`LICENSE`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/LICENSE) file. |
| **Required Owner Approvals** | Approval of author name / entity alignment. |
| **Validation Method** | `node -e "assert.strictEqual(require('./server/package.json').license, 'UNLICENSED')"`<br/>`npm test --prefix client` and `npm run test:unit --prefix server`. |
| **Dependencies** | Owner Decision #1 (Entity Name). |

---

### Category 4: Contributor Guidance and Inbound CLA

| Parameter | Specification & Evidence |
| :--- | :--- |
| **File Paths** | 1. `CONTRIBUTING.md` (new file in root)<br/>2. [`docs/development/contributing.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/docs/development/contributing.md) (update / link) |
| **Current State & Evidence** | Root `CONTRIBUTING.md` does not exist. `docs/development/contributing.md` contains only technical Git branch and PR instructions with zero licensing terms. |
| **Exact Proposed Modification** | Create root `CONTRIBUTING.md` implementing the Stage 7.8 hardened Contributor License Agreement:<br/>1. **Section 1 (Philosophy & Model):** Explains proprietary source-available policy.<br/>2. **Section 2 (Maintainer Discretion):** Maintainers retain absolute authority to accept, reject, modify, or close pull requests.<br/>3. **Section 3 (Inbound CLA):**<br/>   - Inbound license grant model: Contributors retain copyright authorship.<br/>   - Perpetual, worldwide, non-exclusive, royalty-free, irrevocable, sublicensable license granted to the owner to use, reproduce, modify, display, sublicense, and distribute the contribution under any terms (including commercial or closed-source).<br/>   - Contributor patent grant covering patent claims embodied in the PR.<br/>   - Contributor warranty of original authorship.<br/>4. **Section 4 (Technical Guidelines):** Links to testing and build verification standards in `docs/development/contributing.md`. |
| **Classification** | **Process Guidance & Inbound Intellectual Property Contract** |
| **Why Needed** | Protects the owner from contributor copyright disputes and patent ambushes, ensuring unencumbered commercialization freedom while avoiding the legal invalidity risks of claiming automatic copyright assignment without signed transfer deeds. |
| **Required Owner Approvals** | Formal approval of the Inbound CLA terms and maintainer discretion provisions. |
| **Validation Method** | File presence check; verify inbound license scope and patent grant clauses. |
| **Dependencies** | Owner Decisions #1, #5, #6. |

---

### Category 5: Security Disclosure Policy

| Parameter | Specification & Evidence |
| :--- | :--- |
| **File Paths** | 1. `SECURITY.md` (new file in root)<br/>2. [`docs/security/security-controls.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/docs/security/security-controls.md) (cross-reference) |
| **Current State & Evidence** | Root `SECURITY.md` does not exist. `README.md:249` links to `docs/security/security-controls.md`, which specifies technical HTTP/CSRF headers but lacks a private disclosure procedure. |
| **Exact Proposed Modification** | Create root `SECURITY.md` containing:<br/>1. **Supported Versions:** Current release on `main` branch.<br/>2. **Reporting Procedure:** Send vulnerability disclosures privately to `[DEDICATED SECURITY CONTACT EMAIL]`.<br/>3. **Prohibition:** Strictly forbid filing public GitHub issues for unpatched security vulnerabilities.<br/>4. **Triage SLA:** 48 hours for initial response, 5 business days for validation and severity assessment.<br/>5. **Coordinated Disclosure:** 90-day embargo period before public disclosure. |
| **Classification** | **Operational Security Policy & Responsible Disclosure Agreement** |
| **Why Needed** | Prevents public zero-day disclosure of vulnerabilities on GitHub once repository visibility becomes public. |
| **Required Owner Approvals** | Designation of private security contact email address. |
| **Validation Method** | File presence check; confirm email address is active and monitored. |
| **Dependencies** | Owner Decision #4 (Security Email). |

---

### Category 6: Third-Party Dependency Notices and Attribution

| Parameter | Specification & Evidence |
| :--- | :--- |
| **File Paths** | `docs/licenses/THIRD_PARTY_NOTICES.md` (new file) |
| **Current State & Evidence** | All 73 third-party dependencies are permissively licensed (MIT, ISC, BSD, Apache-2.0, FontAwesome OFL/CC-BY). GPL-3.0 (`country-state-city`) was eliminated in Stage 7.10 and replaced with MIT-licensed `country-region-data`. Attribution notices are scattered across individual `node_modules` folders. |
| **Exact Proposed Modification** | Create a consolidated third-party attribution document aggregating copyright notices for: <br/>- `country-region-data` (MIT, Benjamin Keen)<br/>- `libphonenumber-js` (MIT, Cat-in-136)<br/>- `gsap` (GreenSock Standard License)<br/>- FontAwesome Free icons (CC-BY-4.0 / OFL-1.1 / MIT)<br/>- Core runtime libraries (Express, React, FastAPI, Mongoose, Socket.IO) |
| **Classification** | **Third-Party Open-Source License Compliance** |
| **Why Needed** | Satisfies upstream permissive open-source license conditions requiring copyright and permission notice retention when distributing compiled object code. |
| **Required Owner Approvals** | Review and approval of attribution inventory. |
| **Validation Method** | Cross-reference against the 73 audited packages in Stage 7.8 and Stage 7.10. |
| **Dependencies** | None (derived entirely from package metadata). |

---

## 4. Unresolved Owner Decisions & Legal Review Boundaries

To maintain legal precision and ethical integrity, missing values must **not be invented or guessed**. The following decisions are explicitly separated into items that only the owner can provide versus items that require professional legal counsel review:

```text
================================================================================
AUCTIONX PROPRIETARY LICENSING OWNER APPROVAL CHECKLIST
================================================================================

[A] FACTUAL DECISIONS (ONLY THE OWNER CAN PROVIDE)
--------------------------------------------------------------------------------
[ ] 1. COPYRIGHT HOLDER LEGAL ENTITY NAME
       Specify the official legal name of the individual or registered commercial entity:
       Full Legal Name: ________________________________________________________

[ ] 2. COPYRIGHT YEAR
       Specify the copyright year declaration:
       (X) 2026
       ( ) 2024–2026

[ ] 3. DEDICATED SECURITY CONTACT EMAIL
       Specify the private email address for vulnerability disclosures:
       Designated Inbox: _______________________________________________________

[ ] 4. FINAL AUTHORIZATION TO OVERWRITE ROOT LICENSE
       Do you authorize replacing the untracked root MIT LICENSE with the approved
       proprietary source-available license once drafting is complete?
       ( ) AUTHORIZED: Proceed with overwriting root LICENSE.
       ( ) HOLD: Await further legal counsel review.


[B] LEGAL GOVERNANCE DECISIONS (OWNER CHOICE + LEGAL COUNSEL REVIEW)
--------------------------------------------------------------------------------
[ ] 5. GOVERNING LAW AND JURISDICTION
       Specify the governing law and dispute resolution forum for Section 5:
       ( ) State of Maharashtra, India (Courts of Pune / Mumbai)
       ( ) Other State / Country: ______________________________________________
       *Legal Note: Must align with the copyright holder's primary commercial domicile.*

[ ] 6. PROPRIETARY SOURCE-AVAILABLE LICENSE TEXT APPROVAL
       Review and approve the Stage 7.8 hardened license text, confirming:
       - Inspection and non-commercial evaluation are permitted.
       - Commercial SaaS, enterprise hosting, and external redistribution are barred.
       - In-platform GitHub PR forking is permitted; independent forks are barred.
       ( ) APPROVED as drafted in Stage 7.8.
       ( ) REQUIRES REVISION by external legal counsel.

[ ] 7. INBOUND CONTRIBUTOR LICENSE AGREEMENT (CLA) APPROVAL
       Review and approve the inbound broad perpetual license grant model:
       - Contributors retain personal copyright authorship.
       - Owner receives an irrevocable, perpetual, worldwide, commercial,
         sublicensable license to use, modify, and relicense accepted code.
       - Express contributor patent license is granted to the project.
       ( ) APPROVED: Adopt Inbound Perpetual License Grant model.
       ( ) ALTERNATIVE: Require Full Copyright Assignment (higher contributor friction).
================================================================================
```

---

## 5. Separate Technical and Cloud-Release Blockers

Implementation of licensing documentation is strictly separate from production deployment. The following technical blockers from Stage 7.11 and Stage 7.12 remain active and must **not** be bypassed prior to cloud release:

| Blocker Area | Current Technical Status | Required Cloud Verification (Post-Licensing) |
| :--- | :---: | :--- |
| **Docker Engine Runtime** | **`BLOCKED LOCALLY`** | Local Docker Desktop engine is not running (`failed to connect to docker API`). Container execution must be validated on Render during blueprint deployment. |
| **Render Private Networking** | **`BLOCKED ON CLOUD`** | Internal DNS resolution (`http://auctionx-server:10000`) and proxy buffer sizing can only be verified within Render's cloud environment. |
| **Same-Origin Authentication Cookies** | **`REVIEW ITEM`** | **Cookie Policy Reality:** Server code emits `SameSite=None; Secure; HttpOnly` in production and `SameSite=Lax` in local development ([`UserLoginController.js:L71`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/LoginControllers/UserLoginController/UserLoginController.js#L71)). While functional over HTTPS, transitioning to `SameSite=Lax` for production Nginx same-origin routing is recorded as a separate post-deployment security task. **No cookie settings were altered.** |
| **Live CSRF Lifecycle** | **`BLOCKED ON CLOUD`** | Verified via unit tests (28/28 passed), but live browser token exchange (`_csrf` cookie + `X-CSRF-Token` header) requires staging HTTPS testing. |
| **WebSocket Real-Time Bidding** | **`BLOCKED ON CLOUD`** | Server unit coordination tests pass, but live WebSocket upgrade (`/socket.io/`) proxying through Nginx requires an active network listener. |
| **MongoDB Atlas Replica Set** | **`BLOCKED ON CLOUD`** | Multi-document transactions (`session.startTransaction()`) strictly require a replica set (`rs0`). Owner must confirm that the production `MONGODB_URL` in Render points to an Atlas replica set with `retryWrites=true&w=majority`. |

---

## 6. Implementation & Validation Plan (Post-Approval)

Once the owner completes the decision checklist in Section 4, the changes will be executed in three safe phases:

```
+-------------------------------------------------------------------------------+
|                 PHASE 1: REPOSITORY LICENSING NORMALIZATION                   |
+-------------------------------------------------------------------------------+
  1. Overwrite root LICENSE with approved proprietary source-available text.
  2. Update README.md (replace MIT badge and license section).
  3. Update server/package.json ("license": "UNLICENSED", "private": true, "author").
  4. Update client/package.json ("license": "UNLICENSED").
  5. Update recommendation_service/pyproject.toml (license metadata).
  6. Regenerate server/package-lock.json and client/package-lock.json.
  7. Create root CONTRIBUTING.md (inbound CLA + maintainer discretion).
  8. Create root SECURITY.md (private disclosure protocol).
  9. Create docs/licenses/THIRD_PARTY_NOTICES.md (attribution inventory).
                                     |
                                     v
+-------------------------------------------------------------------------------+
|                 PHASE 2: AUTOMATED VERIFICATION & LINT GATES                  |
+-------------------------------------------------------------------------------+
  1. Run `git diff --check` (verify 0 whitespace or formatting errors).
  2. Run `npm test --prefix client` (confirm 8/8 client tests pass).
  3. Run `npm run test:unit --prefix server` (confirm 352/352 server tests pass).
  4. Run `pytest recommendation_service/tests` (confirm 68/68 python tests pass).
  5. Run `npm run build --prefix client` (confirm Vite build succeeds).
  6. Run `gitleaks git --verbose` and `gitleaks git --staged` (0 secrets).
  7. Verify `git grep -i "MIT License"` returns 0 matches in application files.
                                     |
                                     v
+-------------------------------------------------------------------------------+
|                 PHASE 3: STAGING DEPLOYMENT & CLOUD VALIDATION                |
+-------------------------------------------------------------------------------+
  1. Deploy Render blueprint from render.yaml.
  2. Verify /healthz on client Nginx proxy.
  3. Verify internal DNS connection to auctionx-server:10000.
  4. Verify production MongoDB Atlas replica set connection.
  5. Smoke-test login, cookie setting, CSRF token header, and WebSocket bidding.
                                     |
                                     v
+-------------------------------------------------------------------------------+
|                 PHASE 4: PUBLIC GITHUB REPOSITORY RELEASE                     |
+-------------------------------------------------------------------------------+
  1. Stage and commit licensing normalization changes with clear message.
  2. Verify Gitleaks CI workflow passes on GitHub Actions.
  3. Transition repository visibility from Private to Public on GitHub.
```

---

## 7. Git Invariant Verification & Safety Preservation

A status check executed before and after drafting this implementation plan confirms:
1. **Zero files were committed, pushed, fetched, or pulled.**
2. **The root `LICENSE` file was NOT modified, overwritten, or finalized.**
3. **No package manifests, README files, or contributor guides were altered.**
4. **All 27 staged documentation renames remain completely intact in the Git index:**
   - `docs/architecture/` (8 renamed system-design files)
   - `docs/audits/frontend/` (18 renamed frontend audit files)
   - `docs/testing/` (1 renamed test-strategy file)
5. **No database connections were attempted; `Auction-X-Major` was completely ignored.**
6. **No credentials, private keys, or secrets were exposed.**

---

## 8. Final Verdict

**`AWAITING OWNER APPROVAL — NO LICENSING CHANGES APPLIED`**

All necessary analysis, file-by-file modifications, and validation gates are fully documented and ready. The project is awaiting the owner's specific factual inputs (Entity Name, Year, Jurisdiction, Security Email) and formal approval before any files are modified.
