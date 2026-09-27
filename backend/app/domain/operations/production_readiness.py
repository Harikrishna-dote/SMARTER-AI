"""Deterministic production readiness policy for deployment and SRE checks."""

from dataclasses import dataclass
from typing import Protocol


class OperationalSettings(Protocol):
    app_name: str
    environment: str
    api_v1_prefix: str
    jwt_secret: str
    cors_origins: list[str]
    redis_url: str
    gzip_minimum_size: int
    allowed_hosts: list[str]
    auto_create_tables: bool
    create_default_admin: bool
    access_token_expire_minutes: int
    max_chat_history_messages: int
    max_context_chars: int
    feature_flags: dict[str, bool]


@dataclass(frozen=True)
class OperationalControl:
    category: str
    name: str
    status: str
    detail: str
    recommendation: str
    required: bool = False


@dataclass(frozen=True)
class ProductionReadinessReport:
    service: str
    environment: str
    api_version_prefix: str
    status: str
    controls: tuple[OperationalControl, ...]
    blockers: tuple[str, ...]
    warnings: tuple[str, ...]
    feature_flags: dict[str, bool]


def _control(
    category: str,
    name: str,
    status: str,
    detail: str,
    recommendation: str,
    *,
    required: bool = False,
) -> OperationalControl:
    return OperationalControl(
        category=category,
        name=name,
        status=status,
        detail=detail,
        recommendation=recommendation,
        required=required,
    )


def _security_controls(settings: OperationalSettings, production: bool) -> list[OperationalControl]:
    controls = [
        _control(
            "security",
            "jwt_secret_strength",
            "enabled" if len(settings.jwt_secret) >= 32 else ("missing" if production else "warning"),
            "JWT secret is long enough for production signing." if len(settings.jwt_secret) >= 32 else "JWT secret is shorter than 32 characters.",
            "Use a random secret of at least 32 characters from a secure secret manager.",
            required=production,
        ),
        _control(
            "security",
            "trusted_hosts",
            "enabled" if settings.allowed_hosts or not production else "missing",
            "Allowed hosts are explicitly configured." if settings.allowed_hosts else "Allowed hosts are not required outside production.",
            "Set ALLOWED_HOSTS to the exact public domains used by the deployment.",
            required=production,
        ),
        _control(
            "security",
            "cors_policy",
            "missing" if production and "*" in settings.cors_origins else "enabled",
            "CORS is restricted to explicit origins." if "*" not in settings.cors_origins else "Wildcard CORS is configured.",
            "Avoid wildcard CORS in production; use explicit frontend origins.",
            required=production,
        ),
        _control(
            "security",
            "default_admin",
            "missing" if production and settings.create_default_admin else "enabled",
            "Default admin auto-provisioning is disabled." if not settings.create_default_admin else "Default admin auto-provisioning is enabled.",
            "Disable CREATE_DEFAULT_ADMIN in production and provision admins through secure operations.",
            required=production,
        ),
    ]
    return controls


def _performance_controls(settings: OperationalSettings) -> list[OperationalControl]:
    redis_configured = settings.redis_url.strip() != ""
    return [
        _control(
            "performance",
            "gzip",
            "enabled" if settings.gzip_minimum_size <= 1024 else "warning",
            f"GZip starts at {settings.gzip_minimum_size} bytes.",
            "Keep compression enabled for JSON and text responses; tune minimum size per environment.",
        ),
        _control(
            "performance",
            "redis_cache",
            "enabled" if redis_configured else "warning",
            "Redis URL is configured." if redis_configured else "Redis URL is missing.",
            "Use Redis for response cache, sessions, rate limits, voice cache, and streaming coordination.",
        ),
        _control(
            "performance",
            "context_budget",
            "enabled" if settings.max_context_chars <= 80000 else "warning",
            f"Max context characters: {settings.max_context_chars}.",
            "Keep context budgets bounded and retrieve only relevant learning memory.",
        ),
        _control(
            "performance",
            "history_budget",
            "enabled" if settings.max_chat_history_messages <= 250 else "warning",
            f"Max chat history messages: {settings.max_chat_history_messages}.",
            "Limit prompt history and rely on retrieval summaries for long-term context.",
        ),
    ]


def _operations_controls(settings: OperationalSettings, metrics_available: bool, production: bool) -> list[OperationalControl]:
    return [
        _control(
            "observability",
            "health_endpoint",
            "enabled",
            "Health and readiness endpoints are available.",
            "Wire these endpoints to load balancers, uptime checks, and deployment smoke tests.",
        ),
        _control(
            "observability",
            "metrics",
            "enabled" if metrics_available else "warning",
            "Prometheus instrumentation is available." if metrics_available else "Prometheus instrumentation package is not installed.",
            "Install prometheus-fastapi-instrumentator in production images when metrics scraping is required.",
        ),
        _control(
            "scalability",
            "schema_migrations",
            "missing" if production and settings.auto_create_tables else "enabled",
            "Automatic table creation is disabled." if not settings.auto_create_tables else "Automatic table creation is enabled.",
            "Use versioned migrations for production schema changes.",
            required=production,
        ),
        _control(
            "api",
            "versioning",
            "enabled" if settings.api_v1_prefix.startswith("/api/v") else "missing",
            f"API prefix is {settings.api_v1_prefix}.",
            "Keep public routes versioned and document migration paths.",
            required=True,
        ),
    ]


def build_production_readiness_report(
    settings: OperationalSettings,
    *,
    metrics_available: bool = False,
) -> ProductionReadinessReport:
    environment = settings.environment.lower()
    production = environment == "production"
    controls = tuple(
        [
            *_security_controls(settings, production),
            *_performance_controls(settings),
            *_operations_controls(settings, metrics_available, production),
        ]
    )
    blockers = tuple(
        f"{control.category}.{control.name}: {control.detail}"
        for control in controls
        if control.required and control.status == "missing"
    )
    warnings = tuple(
        f"{control.category}.{control.name}: {control.detail}"
        for control in controls
        if control.status == "warning"
    )
    status = "blocked" if blockers else "degraded" if warnings else "ready"
    return ProductionReadinessReport(
        service=settings.app_name,
        environment=settings.environment,
        api_version_prefix=settings.api_v1_prefix,
        status=status,
        controls=controls,
        blockers=blockers,
        warnings=warnings,
        feature_flags=dict(settings.feature_flags),
    )
