"""FastAPI integration for the plugin system.

:class:`PluginManager` ties together the loader, registry, and event bus with
a :class:`fastapi.FastAPI` application. It is intentionally instantiated once
per app and driven from the application :func:`lifespan`.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from fastapi import FastAPI

from app.plugins.base import Plugin
from app.plugins.events import Event, get_event_bus
from app.plugins.loader import PluginLoader
from app.plugins.registry import PluginRegistry, get_plugin_registry

logger = logging.getLogger(__name__)


class PluginManager:
    """Orchestrates discovery, registration, and FastAPI wiring of plugins.

    Args:
        app: The FastAPI application plugins are attached to.
        plugins_dir: Optional override for the plugin search directory.
        registry: Optional pre-existing registry (defaults to the singleton).
    """

    def __init__(
        self,
        app: FastAPI,
        plugins_dir: str | None = None,
        registry: PluginRegistry | None = None,
    ) -> None:
        self.app = app
        self.registry: PluginRegistry = registry or get_plugin_registry()
        self._loader_params: dict[str, Any] = {"plugins_dir": plugins_dir}

    def __repr__(self) -> str:  # pragma: no cover - trivial
        return f"<PluginManager plugins={self.registry.plugin_count}>"

    @property
    def loader(self) -> PluginLoader:
        """A fresh :class:`PluginLoader` bound to this manager's registry."""
        return PluginLoader(registry=self.registry, **self._loader_params)

    def discover(self) -> list[Any]:
        """Load all plugins from disk into the registry."""
        loaded = self.loader.load_all()
        logger.info("Discovered and loaded %d plugin(s)", len(loaded))
        return loaded

    async def initialize(self, settings: Any | None = None) -> None:
        """Discover plugins then initialise them in dependency order."""
        self.discover()
        await self.registry.initialize_all(settings)
        event_bus = get_event_bus()
        await event_bus.publish(
            Event(name="plugins_loaded", data={"count": self.registry.plugin_count})
        )

    def register_routes(self) -> None:
        """Include every plugin's routers under ``/plugins/{name}``."""
        for plugin in self.registry.iter_ordered():
            prefix = f"/plugins/{plugin.metadata.name}"
            for router in plugin.get_routes():
                self.app.include_router(router, prefix=prefix)
                logger.debug(
                    "Registered routes for plugin %s under %s",
                    plugin.metadata.name,
                    prefix,
                )

    def register_dependencies(self) -> None:
        """Wire plugin-provided service factories into FastAPI's DI system.

        Each ``name -> factory`` pair is:

        * mirrored on ``app.state.plugin_services`` for introspection, and
        * registered as a dependency override keyed by
          :func:`app.core.deps.plugin_service`, so routes can resolve services
          via ``Depends(plugin_service("name"))`` and receive the factory
          callable itself to invoke with whatever arguments they need.
        """
        from app.core.deps import plugin_service

        services = self.registry.get_services()
        if not hasattr(self.app.state, "plugin_services"):
            self.app.state.plugin_services = {}
        self.app.state.plugin_services.update(services)

        for name in services:
            self.app.dependency_overrides[plugin_service(name)] = self._make_service_override(name)
            logger.debug("Registered dependency override for plugin service %s", name)

    def _make_service_override(self, name: str) -> Callable[[], Any]:
        """Build a zero-arg dependency callable returning the service factory."""
        registry = self.registry

        def _provide() -> Any:
            return registry.get_services().get(name)

        _provide.__name__ = f"plugin_service_override_{name}"
        _provide.__qualname__ = f"PluginManager._make_service_override.<locals>._provide"
        return _provide

    def register_middlewares(self) -> None:
        """Hook for plugins to contribute ASGI middlewares.

        Plugins may override ``get_middlewares`` returning callables accepting
        ``(app, **kwargs)``; they are applied in priority order.
        """
        for plugin in self.registry.iter_ordered():
            middlewares = getattr(plugin, "get_middlewares", None)
            if middlewares is None:
                continue
            for mw in middlewares():
                self.app.add_middleware(mw)
                logger.debug("Added middleware from plugin %s", plugin.metadata.name)

    async def shutdown(self) -> None:
        """Publish a shutdown event then shut all plugins down."""
        await get_event_bus().publish(Event(name="plugins_unloading"))
        await self.registry.shutdown_all()

    def get_plugin(self, name: str) -> Plugin | None:
        """Look up a loaded plugin by name."""
        return self.registry.get_plugin(name)

    def list_plugins(self) -> list[dict[str, Any]]:
        """Return a serializable summary of every loaded plugin."""
        summary: list[dict[str, Any]] = []
        for plugin in self.registry.get_all_plugins():
            meta = plugin.metadata
            summary.append(
                {
                    "name": meta.name,
                    "version": meta.version,
                    "category": meta.category.value,
                    "description": meta.description,
                    "author": meta.author,
                    "dependencies": list(meta.dependencies),
                    "enabled": meta.enabled,
                    "priority": meta.priority,
                }
            )
        return summary
