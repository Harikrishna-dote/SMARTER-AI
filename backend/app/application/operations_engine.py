"""Application use cases for production readiness and operational diagnostics."""

from app.core.config import Settings, get_settings
from app.domain.operations import ProductionReadinessReport, build_production_readiness_report
from app.schemas.operations import OperationalControlResponse, ProductionReadinessResponse


class OperationsEngine:
    def __init__(self, settings: Settings | None = None, *, metrics_available: bool = False):
        self.settings = settings or get_settings()
        self.metrics_available = metrics_available

    def readiness(self) -> ProductionReadinessResponse:
        return self._to_response(
            build_production_readiness_report(
                self.settings,
                metrics_available=self.metrics_available,
            )
        )

    @staticmethod
    def _to_response(report: ProductionReadinessReport) -> ProductionReadinessResponse:
        return ProductionReadinessResponse(
            service=report.service,
            environment=report.environment,
            api_version_prefix=report.api_version_prefix,
            status=report.status,
            controls=[
                OperationalControlResponse(
                    category=control.category,
                    name=control.name,
                    status=control.status,
                    detail=control.detail,
                    recommendation=control.recommendation,
                    required=control.required,
                )
                for control in report.controls
            ],
            blockers=list(report.blockers),
            warnings=list(report.warnings),
            feature_flags=report.feature_flags,
        )
