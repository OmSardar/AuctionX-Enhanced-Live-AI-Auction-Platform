"""
Strongly typed configuration management for AuctionX Recommendation Service.
Consolidates environment resolution, defaults, MongoDB URI parsing, and environment checks.
"""

from dataclasses import dataclass, field
import os
import sys
import urllib.parse
from typing import List, Optional, Tuple
from dotenv import load_dotenv

# Ensure .env is loaded if present
load_dotenv()


def resolve_mongo_configuration(raw_uri: Optional[str] = None, raw_db: Optional[str] = None) -> Tuple[str, str]:
    """Deterministic MongoDB URI & Database Name resolution."""
    mongo_uri = (raw_uri or os.getenv("MONGODB_URI") or "mongodb://127.0.0.1:27017").strip()
    mongo_db_name = raw_db.strip() if raw_db is not None else os.getenv("MONGODB_DB", "").strip()

    # If MONGODB_DB was not explicitly provided, attempt extraction from URI
    if not mongo_db_name:
        try:
            parsed = urllib.parse.urlparse(mongo_uri)
            path = parsed.path.lstrip("/")
            if path:
                mongo_db_name = path
        except Exception:
            pass

    if not mongo_db_name:
        mongo_db_name = "Auction-X"

    return mongo_uri, mongo_db_name


def detect_is_testing(environment: str) -> bool:
    """Detect if execution is running inside pytest or explicit test environment."""
    return (
        environment == "test"
        or "pytest" in sys.modules
        or any("pytest" in str(arg).lower() for arg in sys.argv)
    )


@dataclass
class Settings:
    """Typed application settings instance."""

    environment: str = field(
        default_factory=lambda: os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development")).strip().lower()
    )
    port: int = field(
        default_factory=lambda: int(os.getenv("PORT", "8000"))
    )
    mongodb_uri: str = ""
    mongodb_db: str = ""
    redis_url: Optional[str] = field(
        default_factory=lambda: os.getenv("REDIS_URL")
    )
    client_url: str = field(
        default_factory=lambda: os.getenv("CLIENT_URL", "").strip().rstrip("/")
    )
    allowed_origins_raw: str = field(
        default_factory=lambda: os.getenv("ALLOWED_ORIGINS", "")
    )
    recommendation_hmac_secret: str = field(
        default_factory=lambda: os.getenv("RECOMMENDATION_HMAC_SECRET", "").strip()
    )
    internal_service_key: str = field(
        default_factory=lambda: os.getenv("INTERNAL_SERVICE_KEY", "").strip()
    )
    jwt_secret: str = field(
        default_factory=lambda: os.getenv("JWT_SECRET", "").strip()
    )

    def __post_init__(self):
        # Resolve MongoDB URI and DB Name
        uri, db_name = resolve_mongo_configuration(self.mongodb_uri, self.mongodb_db)
        self.mongodb_uri = uri
        self.mongodb_db = db_name

        # Test environment fallback for internal service key
        if not self.internal_service_key and self.is_testing:
            self.internal_service_key = "test_internal_auctionx_secret_key"

    @property
    def is_testing(self) -> bool:
        return detect_is_testing(self.environment)

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins(self) -> List[str]:
        known_production = [
            "https://auctionx-enhanced.omslabs.tech",
            "https://omslabs.tech",
            "https://auction-x-enhanced-live-ai-auction.vercel.app",
            "https://auction-x-enhanced-live-ai-auction.onrender.com",
            "https://auctionx-client.onrender.com",
        ]
        configured = [
            o.strip().rstrip("/")
            for o in self.allowed_origins_raw.split(",")
            if o.strip()
        ]
        origins = list(dict.fromkeys(known_production + configured + ([self.client_url] if self.client_url else [])))

        # In non-production, ensure standard development frontend origins are allowed
        if not self.is_production:
            dev_origins = [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ]
            for dev_origin in dev_origins:
                if dev_origin not in origins:
                    origins.append(dev_origin)
        return origins


def get_settings() -> Settings:
    """Factory creating a new Settings snapshot from current environment."""
    return Settings()
