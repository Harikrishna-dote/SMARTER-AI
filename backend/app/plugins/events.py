"""Event system for decoupled plugin communication.

Provides a lightweight pub/sub :class:`EventBus` so plugins can react to
lifecycle and domain events (e.g. ``user_registered``, ``lesson_completed``)
without holding direct references to one another.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Protocol

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class Event:
    """A message published on the :class:`EventBus`.

    Attributes:
        name: Identifier of the event (e.g. ``"user_registered"``).
        data: Arbitrary payload associated with the event.
        timestamp: Unix timestamp at which the event was created.
    """

    name: str
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)


class EventHandler(Protocol):
    """A coroutine invoked when a matching :class:`Event` is published.

    Any object whose ``__call__`` is an awaitable accepting a single
    :class:`Event` (e.g. an ``async def`` function or method) satisfies this
    protocol structurally.
    """

    async def __call__(self, event: Event) -> None: ...


EventName = str


class EventBus:
    """Publish/subscribe bus for asynchronous event handling.

    Subscribers register coroutines that accept a single :class:`Event`.
    When :meth:`publish` is called every matching handler is scheduled as an
    asyncio task so slow handlers never block the publisher.
    """

    def __init__(self) -> None:
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)

    def subscribe(self, event_name: str, handler: EventHandler) -> None:
        """Register ``handler`` to be invoked for events named ``event_name``."""
        if handler not in self._handlers[event_name]:
            self._handlers[event_name].append(handler)
        logger.debug("Subscribed handler %r to event %r", handler, event_name)

    def unsubscribe(self, event_name: str, handler: EventHandler) -> None:
        """Remove a previously registered ``handler`` for ``event_name``."""
        if handler in self._handlers.get(event_name, []):
            self._handlers[event_name].remove(handler)
            logger.debug("Unsubscribed handler %r from event %r", handler, event_name)

    def subscribe_batch(self, event_handlers: dict[str, EventHandler]) -> None:
        """Register several handlers at once."""
        for event_name, handler in event_handlers.items():
            self.subscribe(event_name, handler)

    def get_handlers(self, event_name: str) -> list[EventHandler]:
        """Return a copy of the handlers registered for ``event_name``."""
        return list(self._handlers.get(event_name, []))

    @property
    def event_names(self) -> list[str]:
        """Return all event names that currently have subscribers."""
        return list(self._handlers.keys())

    async def publish(self, event: Event) -> list[Any]:
        """Publish ``event`` to all subscribers.

        Handlers are executed concurrently. Their return values are collected
        and returned so callers may inspect results. Exceptions inside a
        handler are logged but do not cancel sibling handlers.
        """
        handlers = self._handlers.get(event.name, [])
        if not handlers:
            return []

        async def _safe_invoke(handler: EventHandler) -> Any:
            try:
                return await handler(event)
            except Exception:
                logger.exception("Event handler %r failed for event %r", handler, event.name)
                return None

        results = await asyncio.gather(*(_safe_invoke(h) for h in handlers))
        return list(results)

    def publish_fire_and_forget(self, event: Event) -> list[asyncio.Task[Any]]:
        """Schedule handlers without awaiting them.

        Returns the created tasks so callers can optionally await or cancel
        them. Useful when publishing from synchronous contexts.
        """
        handlers = self._handlers.get(event.name, [])
        tasks: list[asyncio.Task[Any]] = []
        for handler in handlers:
            tasks.append(asyncio.create_task(self._invoke(handler, event)))
        return tasks

    async def _invoke(self, handler: EventHandler, event: Event) -> None:
        try:
            await handler(event)
        except Exception:
            logger.exception("Fire-and-forget handler %r failed for event %r", handler, event.name)

    def clear(self) -> None:
        """Remove every subscription."""
        self._handlers.clear()


_event_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    """Return the process-wide :class:`EventBus` singleton."""
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus


def reset_event_bus() -> None:
    """Drop the cached singleton (primarily for testing)."""
    global _event_bus
    _event_bus = None
