"""SMARTER AI plugin system.

This package provides a pluggable architecture that lets first-class
extensions (learning tools, voice providers, assessment engines, etc.)
register routes, services, and event handlers without modifying the core
backend code.

Public entry points:

- :class:`Plugin` / :class:`PluginMetadata` / :class:`PluginCategory`
    Core abstractions every plugin builds on.
- :class:`EventBus` / :func:`get_event_bus`
    Lightweight pub/sub bus for cross-plugin communication.
- :class:`PluginRegistry` / :func:`get_plugin_registry`
    Registry that tracks loaded plugins and orchestrates lifecycle.
- :class:`PluginLoader`
    Discovers and dynamically imports plugins from disk.
- :class:`PluginManager`
    FastAPI integration layer (see :mod:`app.core.plugin_manager`).
"""

from app.plugins.base import Plugin, PluginCategory, PluginMetadata
from app.plugins.events import Event, EventBus, EventHandler, get_event_bus
from app.plugins.loader import PluginLoader, PluginLoadError
from app.plugins.registry import PluginRegistry, get_plugin_registry

__all__ = [
    "Plugin",
    "PluginCategory",
    "PluginMetadata",
    "Event",
    "EventBus",
    "EventHandler",
    "get_event_bus",
    "PluginLoader",
    "PluginLoadError",
    "PluginRegistry",
    "get_plugin_registry",
]
