from collections import Counter, deque
import threading
from typing import Dict, Any, Deque


class MetricsCollector:
    """
    Thread-safe in-memory operational metrics collector with bounded memory.
    Tracks request counts, latencies, and operational telemetry.
    """

    MAX_METRIC_KEYS: int = 100
    DEFAULT_WINDOW_SIZE: int = 1000

    def __init__(self, window_size: int = DEFAULT_WINDOW_SIZE):
        self._lock = threading.Lock()
        self._window_size = window_size
        self._counters: Counter = Counter()
        self._durations: Dict[str, Deque[float]] = {}

    def increment(self, metric: str, amount: int = 1) -> None:
        """Increments a counter metric with bounded cardinality protection."""
        with self._lock:
            if len(self._counters) >= self.MAX_METRIC_KEYS and metric not in self._counters:
                return  # Guard against unbounded metric name proliferation
            self._counters[metric] += amount

    def record_duration(self, metric: str, duration_ms: float) -> None:
        """Records a duration sample in a bounded rolling window."""
        with self._lock:
            if metric not in self._durations:
                if len(self._durations) >= self.MAX_METRIC_KEYS:
                    return  # Guard against unbounded metric name proliferation
                self._durations[metric] = deque(maxlen=self._window_size)
            self._durations[metric].append(float(duration_ms))

    def get_snapshot(self) -> Dict[str, Any]:
        """Returns a snapshot of current counters and latency percentiles."""
        with self._lock:
            summary = dict(self._counters)
            for k, queue in self._durations.items():
                if queue:
                    vals = sorted(queue)
                    n = len(vals)
                    summary[f"{k}_count"] = n
                    summary[f"{k}_avg_ms"] = round(sum(vals) / n, 2)
                    p50_idx = min(int(n * 0.50), n - 1)
                    summary[f"{k}_p50_ms"] = round(vals[p50_idx], 2)
                    p95_idx = min(int(n * 0.95), n - 1)
                    summary[f"{k}_p95_ms"] = round(vals[p95_idx], 2)
            return summary

    def reset(self) -> None:
        """Resets all metrics state (primarily for test isolation)."""
        with self._lock:
            self._counters.clear()
            self._durations.clear()


metrics = MetricsCollector()

