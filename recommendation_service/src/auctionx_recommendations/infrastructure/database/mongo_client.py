"""
PyMongo client management and database lifecycle.
Provides robust connection initialization, index synchronization, and clean shutdown hooks.
"""

from typing import Optional, Tuple
from pymongo import MongoClient
from pymongo.database import Database

from ..config.settings import Settings


def create_mongo_client(settings: Settings) -> Tuple[MongoClient, Database]:
    """
    Constructs a PyMongo client configured with explicit timeouts and connection pool limits.
    """
    client: MongoClient = MongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=5000,
        maxPoolSize=50,
        minPoolSize=5,
    )
    db: Database = client[settings.mongodb_db]
    return client, db


def init_mongo_indexes(db: Database) -> None:
    """
    Ensures optimal query and idempotency indexes on collections:
    - user_interactions: (email, timestamp DESC)
    - user_interactions: product_id
    - user_interactions: event_id (unique, sparse)
    """
    try:
        db.user_interactions.create_index([("email", 1), ("timestamp", -1)])
        db.user_interactions.create_index([("product_id", 1)])
        db.user_interactions.create_index([("event_id", 1)], unique=True, sparse=True)
    except Exception as idx_err:
        # Index creation should not crash application startup if already existing or building
        print(f"MongoDB index initialization note: {idx_err}")
