"""Agent registry and lifecycle management.

:class:`AgentRegistry` is the single source of truth for the set of active
marketplace agents. It validates metadata, supports capability/category
filtering, and exposes lookup helpers used by the orchestrator and API layer.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from app.agents.base import AgentCapability, AgentCategory, BaseAgent

logger = logging.getLogger(__name__)


class AgentRegistryError(Exception):
    """Raised when registry operations fail (duplicates, invalid agents, ...)."""


class AgentRegistry:
    """Tracks registered agents and drives capability-based routing.

    The registry is a process-wide singleton. It supports dynamic registration,
    unregistration, and filtered listing of agents by capability or category.
    """

    _instance: AgentRegistry | None = None

    def __init__(self) -> None:
        self._agents: dict[str, BaseAgent] = {}
        self._listeners: list[Callable[[str, str], None]] = []

    @classmethod
    def get_instance(cls) -> AgentRegistry:
        """Return the process-wide :class:`AgentRegistry` singleton."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def agent_count(self) -> int:
        """Number of registered agents."""
        return len(self._agents)

    def register(self, agent: BaseAgent) -> None:
        """Add ``agent`` to the registry.

        Raises:
            AgentRegistryError: If an agent with the same ``agent_id`` is
                already registered.
        """
        metadata = agent.get_metadata()
        if metadata.agent_id in self._agents:
            raise AgentRegistryError(f"Agent '{metadata.agent_id}' is already registered")
        self._agents[metadata.agent_id] = agent
        self._notify_listeners(metadata.agent_id, "registered")
        logger.info("Registered agent %s (%s)", metadata.agent_id, metadata.name)

    def unregister(self, agent_id: str) -> BaseAgent | None:
        """Remove an agent by ``agent_id``.

        Returns:
            The removed agent, or ``None`` if it was not registered.
        """
        agent = self._agents.pop(agent_id, None)
        if agent is None:
            return None
        self._notify_listeners(agent_id, "unregistered")
        logger.info("Unregistered agent %s", agent_id)
        return agent

    def get_agent(self, agent_id: str) -> BaseAgent | None:
        """Retrieve an agent by its ``agent_id``, or ``None`` if absent."""
        return self._agents.get(agent_id)

    def list_agents(
        self,
        capability: AgentCapability | None = None,
        category: AgentCategory | None = None,
    ) -> list[BaseAgent]:
        """Return registered agents, optionally filtered.

        Args:
            capability: If provided, only agents supporting this capability
                are returned.
            category: If provided, only agents in this category are returned.

        Returns:
            A list of matching :class:`BaseAgent` instances.
        """
        agents = list(self._agents.values())
        if capability is not None:
            agents = [a for a in agents if capability in a.get_capabilities()]
        if category is not None:
            agents = [a for a in agents if a.get_metadata().category == category]
        return agents

    def get_capabilities(self) -> set[AgentCapability]:
        """Return the union of all capabilities across registered agents."""
        capabilities: set[AgentCapability] = set()
        for agent in self._agents.values():
            capabilities.update(agent.get_capabilities())
        return capabilities

    def get_categories(self) -> set[AgentCategory]:
        """Return the set of categories represented by registered agents."""
        return {agent.get_metadata().category for agent in self._agents.values()}

    def route_by_capability(self, capability: AgentCapability) -> list[BaseAgent]:
        """Return agents that support ``capability``, sorted by name.

        This is the primary routing primitive used by the orchestrator to
        select an agent for a given capability.
        """
        matched = [a for a in self._agents.values() if capability in a.get_capabilities()]
        return sorted(matched, key=lambda a: a.get_metadata().name)

    def discover_from_plugins(self) -> None:
        """Discover agents exposed by the existing plugin system.

        Any plugin that sets an ``agent_instance`` attribute to a
        :class:`BaseAgent` implementation will be registered here. This
        provides a lightweight integration point between plugins and the
        agent marketplace without changing the plugin base contract.
        """
        try:
            from app.plugins.registry import get_plugin_registry
        except ImportError:
            logger.debug("Plugin registry not available; skipping plugin discovery")
            return

        plugin_registry = get_plugin_registry()
        for plugin in plugin_registry.get_all_plugins():
            agent = getattr(plugin, "agent_instance", None)
            if agent is not None and isinstance(agent, BaseAgent):
                try:
                    self.register(agent)
                except AgentRegistryError:
                    logger.debug("Plugin agent %s already registered", agent.get_metadata().agent_id)

    def add_listener(self, listener: Callable[[str, str], None]) -> None:
        """Register a listener invoked on register/unregister events.

        Args:
            listener: Callable receiving ``(agent_id, event)`` where event
                is ``"registered"`` or ``"unregistered"``.
        """
        self._listeners.append(listener)

    def get_all_agents(self) -> list[BaseAgent]:
        """Return every registered agent in name order."""
        return sorted(self._agents.values(), key=lambda a: a.get_metadata().name)

    def _notify_listeners(self, agent_id: str, event: str) -> None:
        """Invoke all registered listeners for an agent lifecycle event."""
        for listener in self._listeners:
            try:
                listener(agent_id, event)
            except Exception:
                logger.exception("Agent registry listener raised an exception")


def get_agent_registry() -> AgentRegistry:
    """Return the process-wide :class:`AgentRegistry` singleton."""
    return AgentRegistry.get_instance()
