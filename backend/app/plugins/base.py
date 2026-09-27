"""Core plugin abstractions.

Every plugin extends :class:`Plugin` and exposes a :class:`PluginMetadata`
instance. The metadata describes the plugin identity, category, and
dependencies so the loader and registry can wire everything together without
the core ever importing plugin modules directly.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Any, Callable

from fastapi import APIRouter

from app.plugins.events import EventHandler, get_event_bus

if TYPE_CHECKING:
    from app.plugins.events import EventBus


logger = logging.getLogger(__name__)


class PluginCategory(str, Enum):
    """High-level classification used to query plugins by role."""

    learning_tool = "learning_tool"
    assessment_tool = "assessment_tool"
    voice_provider = "voice_provider"
    translation_provider = "translation_provider"
    visualization_engine = "visualization_engine"
    animation_engine = "animation_engine"
    storage_provider = "storage_provider"
    analytics_provider = "analytics_provider"
    institution_integration = "institution_integration"
    developer_extension = "developer_extension"


@dataclass(frozen=True, slots=True)
class PluginMetadata:
    """Static descriptive information about a plugin.

    Attributes:
        name: Unique, lower-case, hyphen/underscore-separated identifier.
        version: Semantic version string.
        description: Human-readable summary.
        author: Plugin maintainer.
        category: One of :class:`PluginCategory`.
        dependencies: Names of plugins that must be loaded beforehand.
        enabled: Whether the plugin should be initialised by default.
        priority: Load/initialise ordering hint (higher = earlier).
    """

    name: str
    version: str
    description: str
    author: str
    category: PluginCategory
    dependencies: tuple[str, ...] = ()
    enabled: bool = True
    priority: int = 0


class Plugin(ABC):
    """Abstract base class every plugin must implement.

    The lifecycle is intentionally small:

    1. :meth:`initialize` runs once after the plugin is registered, giving it
       access to the settings and event bus.
    2. :meth:`get_routes` / :meth:`get_services` / :meth:`get_event_handlers`
       are inspected by the manager so FastAPI routes and subscriptions can be
       wired up.
    3. :meth:`shutdown` runs once when the application stops.
    """

    metadata: PluginMetadata

    def __init__(self, event_bus: EventHandler | None = None) -> None:
        self.event_bus: EventBus = event_bus or get_event_bus()

    async def initialize(self, settings: Any | None = None) -> None:
        """Run async setup logic.

        Args:
            settings: The application :class:`~app.core.config.Settings`
                instance, allowing plugins to read configuration.
        """
        return None

    async def shutdown(self) -> None:
        """Run async teardown logic (e.g. closing clients)."""
        return None

    @abstractmethod
    def get_routes(self) -> list[APIRouter]:
        """Return FastAPI routers the plugin contributes.

        Returning an empty list is valid for plugins that only provide
        background services or event handlers.
        """
        ...

    @abstractmethod
    def get_services(self) -> dict[str, Callable[..., Any]]:
        """Return named service factories that core/dependencies can use.

        Each value is a callable (sync or async) returning a service instance.
        The key becomes the dependency name resolvable via FastAPI ``Depends``.
        """
        ...

    @abstractmethod
    def get_event_handlers(self) -> dict[str, EventHandler]:
        """Return event-name -> handler mappings to subscribe on init."""
        ...
