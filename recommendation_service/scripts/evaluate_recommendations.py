"""
CLI script to execute offline recommendation quality evaluation.
Usage:
    python scripts/evaluate_recommendations.py [--user <email>]
"""

import argparse
from datetime import datetime, timedelta, timezone
import json
import os
import sys
from bson import ObjectId

# Ensure src/ is on sys.path
_SRC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src")
if _SRC_DIR not in sys.path:
    sys.path.insert(0, _SRC_DIR)

from auctionx_recommendations.evaluation.offline_evaluation import OfflineEvaluator


def generate_synthetic_benchmark_dataset():
    """Generates synthetic benchmark catalog and interaction events for demonstration."""
    now = datetime.now(timezone.utc)
    categories = ["Watches", "Art", "Jewelry", "Electronics", "Collectibles"]
    catalog = []

    for i in range(30):
        pid = str(ObjectId())
        cat = categories[i % len(categories)]
        catalog.append({
            "_id": pid,
            "name": f"Benchmark Product {i}",
            "category": cat,
            "startingPrice": 50 + (i * 10),
            "bidCount": (i * 3) % 25,
            "viewCount": (i * 15) % 100,
            "status": "Active",
            "startTime": (now - timedelta(days=2)).isoformat(),
            "endTime": (now + timedelta(days=5)).isoformat(),
            "createdAt": (now - timedelta(days=10 + i)).isoformat(),
        })

    interactions = []
    user_email = "eval_bench_user@example.com"
    for i in range(12):
        ts = now - timedelta(hours=24 - (i * 2))
        pid = catalog[i % 8]["_id"]
        itype = "purchase" if i == 11 else ("bid" if i % 3 == 0 else "view")
        interactions.append({
            "email": user_email,
            "product_id": pid,
            "interaction_type": itype,
            "timestamp": ts,
        })

    return user_email, catalog, interactions


def main():
    parser = argparse.ArgumentParser(description="Evaluate recommendation ranking quality.")
    parser.add_argument("--user", default=None, help="User email or identifier to evaluate")
    args = parser.parse_args()

    print("=" * 70)
    print("AuctionX Offline Recommendation Quality Evaluation Suite")
    print("=" * 70)

    user_id, catalog, interactions = generate_synthetic_benchmark_dataset()
    target_user = args.user or user_id

    evaluator = OfflineEvaluator(catalog=catalog, interactions=interactions)
    results = evaluator.evaluate_user(target_user, k_values=[4, 8, 12])

    print(f"Target User Evaluated: {results.get('user')}")
    print(f"Train Interactions: {results.get('train_interactions_count')}")
    print(f"Test Holdout Interactions: {results.get('test_interactions_count')}")
    print(f"Evaluation Cutoff: {results.get('cutoff_timestamp')}")
    print("-" * 70)

    metrics = results.get("metrics", {})
    for k, comparison in metrics.items():
        hybrid = comparison.get("hybrid", {})
        baseline = comparison.get("popularity_baseline", {})
        print(f"\n[Depth: {k}]")
        print(f"  Hybrid Model        -> Precision: {hybrid.get('precision'):.4f} | Recall: {hybrid.get('recall'):.4f} | NDCG: {hybrid.get('ndcg_graded'):.4f} | Diversity: {hybrid.get('category_diversity'):.4f}")
        print(f"  Popularity Baseline -> Precision: {baseline.get('precision'):.4f} | Recall: {baseline.get('recall'):.4f} | NDCG: {baseline.get('ndcg_graded'):.4f} | Diversity: {baseline.get('category_diversity'):.4f}")

    print("\n" + "=" * 70)
    print("Evaluation benchmark finished successfully.")
    print("=" * 70)


if __name__ == "__main__":
    main()
