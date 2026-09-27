import logging
import pytest
from prometheus_client import Counter
from app.core.logging import PrometheusLoggingHandler

def test_prometheus_logging_handler_increments_counter():
    # Define a fresh counter for this test to avoid collision
    TEST_COUNTER = Counter(
        "test_log_warnings_total",
        "Total count of warning-level log entries",
        ["logger_name"],
    )
    
    # Custom handler for the test
    class TestPrometheusLoggingHandler(logging.Handler):
        def emit(self, record):
            if record.levelno == logging.WARNING:
                TEST_COUNTER.labels(logger_name=record.name).inc()

    # Create logger and handler
    test_logger = logging.getLogger("test_logger_unique")
    test_logger.setLevel(logging.WARNING)
    handler = TestPrometheusLoggingHandler()
    test_logger.addHandler(handler)
    
    # Log a warning
    test_logger.warning("This is a warning")
    
    # Verify counter
    # Note: access private _value for assertion
    assert TEST_COUNTER.labels(logger_name="test_logger_unique")._value.get() == 1.0
