"""Logging configuration for API runtime and workers."""

import logging
from prometheus_client import Counter

# Define a counter for tracking warning logs
LOG_WARNING_COUNTER = Counter(
    "app_log_warnings_total",
    "Total count of warning-level log entries",
    ["logger_name"],
)


class PrometheusLoggingHandler(logging.Handler):
    def emit(self, record):
        if record.levelno == logging.WARNING:
            LOG_WARNING_COUNTER.labels(logger_name=record.name).inc()


def configure_logging(environment: str) -> None:
    level = logging.INFO if environment.lower() == "production" else logging.DEBUG
    logging.basicConfig(
        level=level,
        format="ts=%(asctime)s level=%(levelname)s logger=%(name)s message=%(message)s",
    )
    # Add the Prometheus handler to the root logger
    logging.getLogger().addHandler(PrometheusLoggingHandler())
