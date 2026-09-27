"""Agent registry and plugin system for the AI Brain."""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Type

from app.domain.ai_brain import AgentCapability, ExecutionStep, PlanStatus


class AgentPlugin:
    """Base class for all AI Brain agents."""

    capability: AgentCapability | None = None
    name: str = "base_agent"
    description: str = ""

    async def execute(self, step: ExecutionStep, context: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    async def validate(self, step: ExecutionStep) -> bool:
        return True

    async def health_check(self) -> bool:
        return True


class AgentRegistry:
    """Central registry for all AI Brain agents."""

    def __init__(self) -> None:
        self._plugins: Dict[AgentCapability, AgentPlugin] = {}
        self._factories: Dict[AgentCapability, Callable[[], AgentPlugin]] = {}

    def register(self, capability: AgentCapability, plugin: AgentPlugin | None = None, factory: Callable[[], AgentPlugin] | None = None) -> None:
        if plugin is not None:
            self._plugins[capability] = plugin
        elif factory is not None:
            self._factories[capability] = factory
        else:
            raise ValueError("Either plugin or factory must be provided")

    def get(self, capability: AgentCapability) -> AgentPlugin | None:
        if capability in self._plugins:
            return self._plugins[capability]
        if capability in self._factories:
            plugin = self._factories[capability]()
            self._plugins[capability] = plugin
            return plugin
        return None

    def has(self, capability: AgentCapability) -> bool:
        return capability in self._plugins or capability in self._factories

    def list_capabilities(self) -> list[AgentCapability]:
        return list(set(self._plugins.keys()) | set(self._factories.keys()))

    def list_plugins(self) -> Dict[str, AgentPlugin]:
        result: Dict[str, AgentPlugin] = {}
        for capability, plugin in self._plugins.items():
            result[capability.value] = plugin
        for capability, factory in self._factories.items():
            if capability not in self._plugins:
                plugin = factory()
                self._plugins[capability] = plugin
                result[capability.value] = plugin
        return result

    async def execute_step(self, step: ExecutionStep, context: dict[str, Any]) -> dict[str, Any]:
        agent = self.get(step.agent_capability)
        if agent is None:
            raise ValueError(f"No agent registered for capability: {step.agent_capability}")
        step.status = PlanStatus.EXECUTING
        try:
            output = await agent.execute(step, context)
            step.output = output
            step.status = PlanStatus.COMPLETED
            return output
        except Exception as exc:
            step.status = PlanStatus.FAILED
            step.error = str(exc)
            raise


# Global registry instance
_global_registry: AgentRegistry | None = None


def get_registry() -> AgentRegistry:
    global _global_registry
    if _global_registry is None:
        _global_registry = AgentRegistry()
    return _global_registry
