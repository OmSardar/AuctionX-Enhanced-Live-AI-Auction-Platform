"""
Unit tests for MetricsCollector:
Verifies percentile calculations, bounded rolling-window eviction,
thread safety under concurrent load, bounded cardinality, and endpoint exposure.
"""

import concurrent.futures
from fastapi.testclient import TestClient
import pytest

from auctionx_recommendations.infrastructure.observability.metrics import MetricsCollector, metrics
from auctionx_recommendations.main import create_app


class TestMetricsCollector:
    """Verifies operational metrics correctness, thread safety, and bounded memory."""

    def test_counter_increment(self):
        collector = MetricsCollector()
        collector.increment("requests_total")
        collector.increment("requests_total", 4)
        snapshot = collector.get_snapshot()
        assert snapshot["requests_total"] == 5

    def test_duration_percentile_calculation_accuracy(self):
        collector = MetricsCollector()
        # Record 100 durations: 1.0, 2.0, ..., 100.0
        for i in range(1, 101):
            collector.record_duration("test_latency", float(i))

        snapshot = collector.get_snapshot()
        assert snapshot["test_latency_count"] == 100
        assert snapshot["test_latency_avg_ms"] == 50.5
        # With 100 items, p50 index is 50 -> 51.0 ms
        assert snapshot["test_latency_p50_ms"] == 51.0
        # With 100 items, p95 index is 95 -> 96.0 ms
        assert snapshot["test_latency_p95_ms"] == 96.0

    def test_duration_edge_cases_single_and_two_items(self):
        collector = MetricsCollector()
        # Single item edge case
        collector.record_duration("single", 42.0)
        snap1 = collector.get_snapshot()
        assert snap1["single_count"] == 1
        assert snap1["single_avg_ms"] == 42.0
        assert snap1["single_p50_ms"] == 42.0
        assert snap1["single_p95_ms"] == 42.0

        # Two items edge case
        collector.record_duration("two", 10.0)
        collector.record_duration("two", 20.0)
        snap2 = collector.get_snapshot()
        assert snap2["two_count"] == 2
        assert snap2["two_avg_ms"] == 15.0
        assert snap2["two_p50_ms"] == 20.0
        assert snap2["two_p95_ms"] == 20.0

    def test_rolling_window_bounded_eviction(self):
        # Create collector with tiny window size of 5
        collector = MetricsCollector(window_size=5)
        for i in range(1, 11):  # 1 to 10
            collector.record_duration("bounded", float(i))

        snapshot = collector.get_snapshot()
        # Only the last 5 values should remain: 6.0, 7.0, 8.0, 9.0, 10.0
        assert snapshot["bounded_count"] == 5
        assert snapshot["bounded_avg_ms"] == round((6 + 7 + 8 + 9 + 10) / 5, 2)
        assert snapshot["bounded_p50_ms"] == 8.0
        assert snapshot["bounded_p95_ms"] == 10.0

    def test_cardinality_bound_protection(self):
        collector = MetricsCollector()
        # Exceed MAX_METRIC_KEYS
        for i in range(collector.MAX_METRIC_KEYS + 50):
            collector.increment(f"metric_{i}")
            collector.record_duration(f"duration_{i}", 1.0)

        snapshot = collector.get_snapshot()
        # Counters and durations must be capped at MAX_METRIC_KEYS
        assert len(collector._counters) <= collector.MAX_METRIC_KEYS
        assert len(collector._durations) <= collector.MAX_METRIC_KEYS

    def test_thread_safety_under_concurrent_writes(self):
        collector = MetricsCollector(window_size=500)
        num_threads = 20
        ops_per_thread = 50

        def worker(thread_id: int):
            for i in range(ops_per_thread):
                collector.increment("concurrent_ops")
                collector.record_duration("concurrent_latency", float(i))

        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker, t) for t in range(num_threads)]
            concurrent.futures.wait(futures)

        snapshot = collector.get_snapshot()
        assert snapshot["concurrent_ops"] == num_threads * ops_per_thread
        assert snapshot["concurrent_latency_count"] == min(num_threads * ops_per_thread, 500)

    def test_metrics_endpoint_http_exposure(self):
        app = create_app()
        metrics.reset()
        client = TestClient(app)

        # Trigger health check to generate access-log metrics
        health_resp = client.get("/health")
        assert health_resp.status_code in (200, 503)

        # Query /metrics endpoint
        metrics_resp = client.get("/metrics")
        assert metrics_resp.status_code == 200
        data = metrics_resp.json()
        assert "http_requests_total" in data
        assert data["http_requests_total"] >= 1
        assert "http_request_duration_ms_avg_ms" in data

        # Query /api/metrics alias
        api_metrics_resp = client.get("/api/metrics")
        assert api_metrics_resp.status_code == 200
        api_data = api_metrics_resp.json()
        assert "http_requests_total" in api_data
        assert api_data["http_requests_total"] >= 2
        assert "http_request_duration_ms_avg_ms" in api_data
