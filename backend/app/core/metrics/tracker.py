"""Structured observability and metrics."""

import logging
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

@dataclass
class MetricsTracker:
    # Basic metrics store
    request_latencies: dict[str, list[float]] = field(default_factory=dict)
    failure_counts: dict[str, int] = field(default_factory=lambda: {"total": 0})
    success_counts: dict[str, int] = field(default_factory=lambda: {"total": 0})

    def record_request(self, provider: str, latency: float, success: bool):
        self.request_latencies.setdefault(provider, []).append(latency)
        if success:
            self.success_counts["total"] += 1
            self.success_counts.setdefault(provider, 0)
            self.success_counts[provider] += 1
        else:
            self.failure_counts["total"] += 1
            self.failure_counts.setdefault(provider, 0)
            self.failure_counts[provider] += 1
            
        logger.info(f"Metrics: provider={provider}, latency={latency:.3f}s, success={success}")

    def get_summary(self) -> dict[str, Any]:
        return {
            "latencies": {p: sum(l)/len(l) for p, l in self.request_latencies.items() if l},
            "success_counts": self.success_counts,
            "failure_counts": self.failure_counts,
        }

metrics_tracker = MetricsTracker()
