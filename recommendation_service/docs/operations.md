# AuctionX Recommendation Service — Operational Guide

## 1. Running Locally

### 1.1 Python Virtual Environment
```bash
cd recommendation_service
python -m venv venv
venv\Scripts\activate       # Windows
# or source venv/bin/activate # Linux/macOS
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

### 1.2 Starting Development Server
```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 1.3 Running Diagnostic Verification
```bash
python scripts/verify_environment.py
```

### 1.4 Running Test Suites
```bash
pytest -v
python test_cors_regression.py
```

---

## 2. Docker & Container Deployment

### 2.1 Building Docker Image
From the repository root or `recommendation_service/`:
```bash
docker build -t auctionx-recommendation-service:latest -f recommendation_service/Dockerfile recommendation_service/
```

### 2.2 Running with Docker Compose
```bash
# Development (with Uvicorn auto-reload mounted)
docker compose up recommendation-service

# Production (hardened runtime, no auto-reload)
docker compose -f compose.prod.yaml up recommendation-service
```

---

## 3. Configuration Reference

| Variable | Required | Default | Purpose |
| :--- | :---: | :---: | :--- |
| `ENVIRONMENT` | No | `development` | Runtime environment (`development`, `test`, `production`). |
| `PORT` | No | `8000` | HTTP listener port assigned by container or host. |
| `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017` | PyMongo connection string. |
| `MONGODB_DB` | No | `Auction-X` | Target MongoDB database name. |
| `REDIS_URL` | No | `None` | Managed Redis connection string. Falls back to in-memory non-blocking mode if omitted. |
| `CLIENT_URL` | No | `http://localhost:5173` | Primary frontend web application origin. |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated CORS allowed origins. |
| `INTERNAL_SERVICE_KEY` | Yes (Prod) | `test_internal...` (Test) | Shared secret for backend Express proxy authentication. |
| `RECOMMENDATION_HMAC_SECRET` | Yes (Prod) | `fallback_secret` | Keyed HMAC-SHA256 secret for user PII pseudonymization. |
