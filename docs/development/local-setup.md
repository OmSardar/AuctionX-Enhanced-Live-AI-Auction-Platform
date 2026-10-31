# AuctionX — Local Development Setup Guide

> **Document Classification:** Engineering Onboarding & Setup  
> **Status:** Active / Normative  
> **Last Verified:** October 2026  

---

## 1. Prerequisites & System Requirements

Before running AuctionX locally, ensure the following dependencies are installed on your host system:

| Dependency | Minimum Version | Recommended | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v20.0.0` (LTS) | `v20.18.0` / `v22.x` | Required for backend and frontend tooling. |
| **npm** | `v10.0.0` | `v10.8.0+` | Package manager for `server/`, `client/`, and `e2e/`. |
| **Python** | `v3.10.0` | `v3.10.x` – `v3.13.x` | Required for recommendation service microservice. |
| **MongoDB** | `v7.0.0` | `v7.0.x Community` | Standalone or replica set running on port `27017`. |
| **Redis** | `v7.0.0` | `v7-alpine` | In-memory cache for recommendation service on port `6379`. |
| **Docker & Compose** | `v24.0.0` | `v27.x+` (Docker Desktop) | Optional: for hermetic containerized local stack. |

---

## 2. Repository Cloning & Setup

Clone the official public repository:

```bash
# 1. Clone the repository
git clone https://github.com/OmSardar/AuctionX-Enhanced-Live-AI-Auction-Platform.git auctionx
cd auctionx

# 2. Verify remote configuration
git remote -v
# Expected:
# origin   https://github.com/OmSardar/AuctionX-Enhanced-Live-AI-Auction-Platform.git (fetch)
# origin   https://github.com/OmSardar/AuctionX-Enhanced-Live-AI-Auction-Platform.git (push)
```

---

## 3. Environment Configuration

AuctionX provides exhaustive example configuration files for every subsystem. **Never commit real secrets or `.env` files to git.**

```bash
# Monorepo root environment
cp .env.example .env

# Backend Express environment
cp server/.env.example server/.env

# Client React environment
cp client/.env.example client/.env.local

# Recommendation FastAPI microservice environment
cp recommendation_service/.env.example recommendation_service/.env
```

### Essential Local Configuration Values

In `server/.env`:
- `PORT=5000`
- `NODE_ENV=development`
- `MONGODB_URL=mongodb://127.0.0.1:27017/Auction-X`
- `JWT_SECRET=auctionx_dev_jwt_secret_key_minimum_32_characters_long`
- `RECOMMENDATION_HMAC_SECRET=auctionx_dev_rec_hmac_secret_minimum_32_characters_long`
- `INTERNAL_SERVICE_KEY=auctionx_dev_internal_service_key_minimum_32_characters_long`
- `CLIENT_URL=http://localhost:5173`
- `RECOMMENDATION_SERVICE_URL=http://localhost:8000`

In `recommendation_service/.env`:
- `PORT=8000`
- `ENVIRONMENT=development`
- `MONGODB_URI=mongodb://127.0.0.1:27017`
- `MONGODB_DB=Auction-X`
- `REDIS_URL=redis://127.0.0.1:6379/0`
- `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173`
- `RECOMMENDATION_HMAC_SECRET=auctionx_dev_rec_hmac_secret_minimum_32_characters_long`
- `INTERNAL_SERVICE_KEY=auctionx_dev_internal_service_key_minimum_32_characters_long`

In `client/.env.local`:
- `VITE_API_URL=http://localhost:5000`
- `VITE_RECOMMENDATION_API_URL=http://localhost:8000/api`
- `VITE_RAZORPAY_API_KEY=rzp_test_placeholder_key`

---

## 4. Installing Dependencies

Install dependencies across all subsystems:

```bash
# 1. Server dependencies
cd server
npm ci
cd ..

# 2. Client dependencies
cd client
npm ci
cd ..

# 3. Recommendation Service dependencies
cd recommendation_service
python -m venv .venv
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Linux / macOS:
# source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cd ..
```

---

## 5. Database Initialization & Admin Bootstrapping

1. Ensure MongoDB is running locally (`mongosh --eval "db.runCommand({ ping: 1 })"`).
2. Seed initial demo catalog items:
   ```bash
   cd server
   npm run seed:demo
   ```
3. Bootstrap an administrator account:
   ```bash
   npm run admin:bootstrap
   ```
   This safely provisions an administrator record in both the `Admin` and `User` collections (`role: 'admin'`). Default credentials:
   - **Email:** `admin@auctionx.com`
   - **Password:** `AdminPassword123!`

---

## 6. Running Services Locally

You can run services individually in dedicated terminal tabs or together via Docker Compose.

### Option A: Running Native Local Processes (Fastest Development Loop)

- **Terminal 1 — Core Backend (Port 5000):**
  ```bash
  cd server
  npm run dev
  ```
- **Terminal 2 — Recommendation Microservice (Port 8000):**
  ```bash
  cd recommendation_service
  .venv\Scripts\Activate.ps1
  uvicorn main:app --reload --host 127.0.0.1 --port 8000
  ```
- **Terminal 3 — React Client Application (Port 5173):**
  ```bash
  cd client
  npm run dev
  ```

### Option B: Running Full Stack via Docker Compose

```bash
# Validates configuration and starts all 5 containers (client, server, recommendation, mongo, redis)
docker compose up --build
```

---

## 7. Running Tests Locally

Verify your installation by running the automated test suites:

```bash
# 1. Run all backend unit tests (319 tests across 26 suites)
npm test --prefix server -- tests/unit

# 2. Run backend integration tests
npm test --prefix server -- tests/integration

# 3. Run recommendation service tests
cd recommendation_service
pytest tests/
cd ..

# 4. Verify client production build
npm run build --prefix client
```
