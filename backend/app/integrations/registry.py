from typing import Any

from app.integrations.base import IntegrationType
from app.plugins.events import Event, get_event_bus


class IntegrationRegistry:
    def __init__(self) -> None:
        self._integrations: dict[str, Any] = {}
        self._event_bus = get_event_bus()

    def register(self, integration: Any) -> None:
        integration_id = getattr(integration, "integration_id", None) or getattr(integration, "metadata", {}).get("integration_id")
        if not integration_id:
            raise ValueError("Integration must have an integration_id")
        self._integrations[integration_id] = integration
        self._event_bus.publish(Event(name="integration.registered", data={"integration_id": integration_id}))

    def unregister(self, integration_id: str) -> None:
        if integration_id in self._integrations:
            del self._integrations[integration_id]
            self._event_bus.publish(Event(name="integration.unregistered", data={"integration_id": integration_id}))

    def get_integration(self, integration_id: str) -> Any | None:
        return self._integrations.get(integration_id)

    def list_integrations(self, integration_type: IntegrationType | None = None) -> list[dict[str, Any]]:
        result = []
        for integration in self._integrations.values():
            metadata = getattr(integration, "get_metadata", lambda: {})()
            if integration_type and metadata.get("type") != integration_type:
                continue
            result.append({
                "integration_id": metadata.get("integration_id"),
                "name": metadata.get("name"),
                "type": metadata.get("type"),
                "version": metadata.get("version"),
                "description": metadata.get("description"),
                "vendor": metadata.get("vendor"),
            })
        return result


integration_registry = IntegrationRegistry()
