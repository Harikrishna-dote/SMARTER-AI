"""Plugin registry and lifecycle orchestration.

:class:`PluginRegistry` is the single source of truth for the set of active
plugins. It validates metadata, orders plugins by dependency/priority, and
exposes lookup helpers used by the FastAPI :class:`PluginManager`.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Any

from app.plugins.base import Plugin, PluginCategory, PluginMetadata
from app.plugins.events import EventBus, EventHandler, get_event_bus

logger = logging.getLogger(__name__)


class PluginRegistryError(Exception):
    """Raised when registry operations fail (dependency cycles, duplicates, ...)."""


class PluginRegistry:
    """Tracks registered plugins and drives their lifecycle.

    A registry owns a single :class:`EventBus` used for plugin-to-plugin
    communication as well as FastAPI route wiring.
    """

    def __init__(self, event_bus: EventBus | None = None) -> None:
        self._event_bus: EventBus = event_bus or get_event_bus()
        self._plugins: dict[str, Plugin] = {}
        self._subscribed: dict[str, list[tuple[str, EventHandler]]] = {}

    @property
    def event_bus(self) -> EventBus:
        """The bus plugins publish/subscribe on."""
        return self._event_bus

    @property
    def plugin_count(self) -> int:
        """Number of registered plugins."""
        return len(self._plugins)

    def register(self, plugin: Plugin) -> None:
        """Add ``plugin`` to the registry.

        Raises :class:`PluginRegistryError` if a plugin with the same name is
        already registered. Dependencies are *not* resolved at registration
        time; :meth:`initialize_all` performs topological ordering.
        """
        name = plugin.metadata.name
        if name in self._plugins:
            raise PluginRegistryError(f"Plugin '{name}' is already registered")
        self._plugins[name] = plugin
        logger.debug("Registered plugin %s (%s)", name, plugin.metadata.version)

    def unregister(self, plugin_name: str) -> Plugin | None:
        """Remove a plugin by name and unsubscribe its event handlers."""
        plugin = self._plugins.pop(plugin_name, None)
        if plugin is None:
            return None
        self._unsubscribe_handlers(plugin_name)
        logger.debug("Unregistered plugin %s", plugin_name)
        return plugin

    def get_plugin(self, name: str) -> Plugin | None:
        """Retrieve a plugin by its name, or ``None`` if absent."""
        return self._plugins.get(name)

    def get_plugins_by_category(self, category: PluginCategory | str) -> list[Plugin]:
        """Return all registered plugins matching ``category`` (in priority order)."""
        cat = category.value if isinstance(category, PluginCategory) else category
        matched = [p for p in self.iter_ordered() if p.metadata.category.value == cat]
        return matched

    def get_all_plugins(self) -> list[Plugin]:
        """Return every registered plugin in priority order."""
        return list(self.iter_ordered())

    def get_services(self) -> dict[str, Callable[..., Any]]:
        """Aggregate service factories contributed by all registered plugins.

        Computed on demand so it always reflects the current plugin set,
        including plugins registered after :meth:`initialize_all` ran.
        """
        services: dict[str, Callable[..., Any]] = {}
        for plugin in self._plugins.values():
            services.update(plugin.get_services())
        return services

    def has_plugin(self, name: str) -> bool:
        """Whether a plugin with ``name`` is registered."""
        return name in self._plugins

    def iter_ordered(self) -> list[Plugin]:
        """Return plugins sorted by descending priority then name.

        Note: full dependency resolution happens in :meth:`initialize_all`;
        this helper gives a deterministic, priority-weighted ordering.
        """
        return sorted(
            self._plugins.values(),
            key=lambda p: (-p.metadata.priority, p.metadata.name),
        )

    def _topological_order(self) -> list[Plugin]:
        """Order plugins honoring declared dependencies (Kahn's algorithm).

        Plugins whose dependencies are unsatisfied raise :class:`PluginRegistryError`.
        """
        names = {p.metadata.name: p for p in self._plugins.values()}
        deps: dict[str, list[str]] = {
            name: [d for d in p.metadata.dependencies if d in names]
            for name, p in names.items()
        }
        unknown = {
            name: [d for d in p.metadata.dependencies if d not in names]
            for name, p in names.items()
            if any(d not in names for d in p.metadata.dependencies)
        }
        if unknown:
            details = "; ".join(
                f"{name} -> {missing}" for name, missing in unknown.items()
            )
            raise PluginRegistryError(f"Unknown plugin dependencies: {details}")

        in_degree = {name: len(deps_list) for name, deps_list in deps.items()}
        dependents: dict[str, list[str]] = defaultdict(list)
        for name, deps_list in deps.items():
            for dep in deps_list:
                dependents[dep].append(name)

        ready = sorted((n for n, d in in_degree.items() if d == 0))
        ordered: list[str] = []
        while ready:
            current = ready.pop(0)
            ordered.append(current)
            for child in dependents.get(current, []):
                in_degree[child] -= 1
                if in_degree[child] == 0:
                    ready.append(child)
            ready.sort()

        if len(ordered) != len(names):
            remaining = set(names) - set(ordered)
            raise PluginRegistryError(
                f"Dependency cycle detected among plugins: {sorted(remaining)}"
            )

        plugins = [names[n] for n in ordered]
        plugins.sort(key=lambda p: (-p.metadata.priority, p.metadata.name))
        return plugins

    async def initialize_all(self, settings: Any | None = None) -> None:
        """Initialize plugins in dependency/priority order and subscribe handlers.

        Also aggregates each plugin's contributed services and routes for later
        access by the :class:`PluginManager`.
        """
        ordered = self._topological_order()
        for plugin in ordered:
            await self._initialize_plugin(plugin, settings)

    async def _initialize_plugin(self, plugin: Plugin, settings: Any | None) -> None:
        name = plugin.metadata.name
        logger.info("Initializing plugin %s %s", name, plugin.metadata.version)
        try:
            await plugin.initialize(settings)
        except Exception:
            logger.exception("Plugin '%s' raised during initialize()", name)
            return
        handlers: list[tuple[str, EventHandler]] = []
        for event_name, handler in plugin.get_event_handlers().items():
            self._event_bus.subscribe(event_name, handler)
            handlers.append((event_name, handler))
        self._subscribed[name] = handlers
        logger.debug("Plugin '%s' initialized; handlers subscribed", name)

    def _unsubscribe_handlers(self, name: str) -> None:
        """Unsubscribe the exact handler objects previously recorded for ``name``."""
        handlers = self._subscribed.pop(name, [])
        for event_name, handler in handlers:
            self._event_bus.unsubscribe(event_name, handler)

    async def shutdown_all(self) -> None:
        """Shut every plugin down in reverse dependency order."""
        ordered = list(reversed(self._topological_order_safe()))
        for plugin in ordered:
            await self._shutdown_plugin(plugin)

    def _topological_order_safe(self) -> list[Plugin]:
        """Like :meth:`_topological_order` but never raises (used on shutdown)."""
        try:
            return self._topological_order()
        except PluginRegistryError as exc:
            logger.warning("Skipping dependency-ordered shutdown: %s", exc)
            return self.iter_ordered()

    async def _shutdown_plugin(self, plugin: Plugin) -> None:
        name = plugin.metadata.name
        logger.info("Shutting down plugin %s", name)
        self._unsubscribe_handlers(name)
        try:
            await plugin.shutdown()
        except Exception:
            logger.exception("Plugin '%s' raised during shutdown()", name)


_registry: PluginRegistry | None = None


def get_plugin_registry() -> PluginRegistry:
    """Return the process-wide :class:`PluginRegistry` singleton."""
    global _registry
    if _registry is None:
        _registry = PluginRegistry()
    return _registry


def reset_plugin_registry() -> None:
    """Drop the cached singleton (primarily for testing)."""
    global _registry
    _registry = None
