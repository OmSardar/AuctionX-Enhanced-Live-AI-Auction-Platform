"""
Diagnostic script to verify runtime environment, database connectivity, and configuration.
Usage:
    python scripts/verify_environment.py
"""

import os
import sys

# Ensure src/ is on sys.path
_SRC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src")
if _SRC_DIR not in sys.path:
    sys.path.insert(0, _SRC_DIR)

from auctionx_recommendations.infrastructure.config.settings import get_settings
from auctionx_recommendations.infrastructure.database.mongo_client import create_mongo_client
from auctionx_recommendations.infrastructure.cache.redis_cache import build_redis_client


def main():
    print("=" * 60)
    print("AuctionX Recommendation Service — Environment Diagnostic")
    print("=" * 60)

    # 1. Python runtime
    py_version = sys.version.split()[0]
    print(f"[x] Python Version: {py_version}")
    if sys.version_info < (3, 10):
        print("  [ERROR] Python >= 3.10 is required.")
        sys.exit(1)

    # 2. Settings resolution
    settings = get_settings()
    print(f"[x] Environment: {settings.environment}")
    print(f"[x] Port: {settings.port}")
    print(f"[x] MongoDB Target: {settings.mongodb_uri} / {settings.mongodb_db}")
    print(f"[x] Redis URL configured: {'Yes' if settings.redis_url else 'No (in-memory mode)'}")
    print(f"[x] Internal Service Key: {'Configured' if settings.internal_service_key else 'Missing (fail-closed)'}")
    print(f"[x] HMAC Secret: {'Configured' if settings.recommendation_hmac_secret else 'Default/Fallback'}")

    # 3. MongoDB connectivity
    try:
        client, db = create_mongo_client(settings)
        client.admin.command("ping")
        print(f"[SUCCESS] MongoDB connected successfully to database: {db.name}")
        client.close()
    except Exception as e:
        print(f"[WARNING] MongoDB ping failed: {e}")

    # 4. Redis connectivity
    if settings.redis_url:
        try:
            r = build_redis_client(settings.redis_url)
            r.ping()
            print("[SUCCESS] Redis cache ping successful")
            r.close()
        except Exception as e:
            print(f"[WARNING] Redis cache unavailable: {e}")

    print("=" * 60)
    print("Environment verification complete.")
    print("=" * 60)


if __name__ == "__main__":
    main()
