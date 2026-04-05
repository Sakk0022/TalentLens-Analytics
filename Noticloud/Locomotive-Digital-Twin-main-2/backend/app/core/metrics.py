from prometheus_client import Counter, Histogram, Gauge


HTTP_REQUESTS_TOTAL = Counter(
    "app_http_requests_total",
    "Total number of HTTP requests",
    ["method", "path", "status_code"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "app_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
)

INGEST_REQUESTS_TOTAL = Counter(
    "app_ingest_requests_total",
    "Total number of telemetry ingest requests",
    ["transport", "locomotive_type"],
)

INGEST_ERRORS_TOTAL = Counter(
    "app_ingest_errors_total",
    "Total number of ingest processing errors",
    ["transport", "error_type"],
)

WS_SIMULATOR_MESSAGES_TOTAL = Counter(
    "app_ws_simulator_messages_total",
    "Total number of messages received on /ws/simulator",
)

WS_SIMULATOR_RATE_LIMIT_TOTAL = Counter(
    "app_ws_simulator_rate_limited_total",
    "Total number of rate-limited websocket simulator events",
)

DB_STATUS = Gauge(
    "app_database_up",
    "Database availability status (1 = up, 0 = down)",
)

APP_READINESS = Gauge(
    "app_readiness",
    "Application readiness status (1 = ready, 0 = not ready)",
)