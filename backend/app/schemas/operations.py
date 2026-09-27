"""Schemas for operational readiness and production diagnostics."""

from pydantic import BaseModel, Field


class OperationalControlResponse(BaseModel):
    category: str
    name: str
    status: str
    detail: str
    recommendation: str
    required: bool = False


class ProductionReadinessResponse(BaseModel):
    service: str
    environment: str
    api_version_prefix: str
    status: str
    controls: list[OperationalControlResponse] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    feature_flags: dict[str, bool] = Field(default_factory=dict)


__all__ = [
    "OperationalControlResponse",
    "ProductionReadinessResponse",
]
