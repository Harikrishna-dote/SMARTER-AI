"""Agent orchestrator for execution, failover, and session management.

:class:`AgentOrchestrator` coordinates agent execution, provides fallback
routing with load balancing, manages multi-agent sessions, and logs all
request/response activity for observability.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from app.agents.base import AgentCapability, AgentRequest, AgentResponse, BaseAgent
from app.agents.registry import AgentRegistry, get_agent_registry
from app.plugins.events import Event, get_event_bus
from app.services.ai_gateway import AIGateway

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class AgentSession:
    """Stateful session for multi-turn agent conversations.

    Attributes:
        session_id: Unique session identifier.
        user_id: Owner of the session.
        agent_ids: Agents participating in this session.
        messages: Chronological list of exchanged messages.
        context: Shared execution context across turns.
        active: Whether the session is still accepting messages.
    """

    session_id: str
    user_id: str
    agent_ids: list[str]
    messages: list[dict[str, Any]] = field(default_factory=list)
    context: dict[str, Any] = field(default_factory=dict)
    active: bool = True
    created_at: float = field(default_factory=time.time)

    def add_message(self, role: str, content: str, agent_id: str | None = None) -> None:
        """Append a message to the session history."""
        self.messages.append(
            {
                "role": role,
                "content": content,
                "agent_id": agent_id,
                "timestamp": time.time(),
            }
        )

    def get_history(self, limit: int | None = None) -> list[dict[str, Any]]:
        """Return the session message history, optionally truncated."""
        history = list(self.messages)
        if limit is not None:
            history = history[-limit:]
        return history


@dataclass(slots=True)
class ExecutionLog:
    """Audit record for a single agent execution.

    Attributes:
        request_id: Unique request identifier.
        agent_id: Agent that handled the request.
        status: Final execution status.
        latency_ms: Wall-clock execution time in milliseconds.
        tokens_used: Estimated token consumption.
        timestamp: Unix timestamp of completion.
    """

    request_id: str
    agent_id: str
    status: str
    latency_ms: int
    tokens_used: int
    timestamp: float = field(default_factory=time.time)


class AgentManager:
    """Coordinates agent execution with load balancing, failover, and sessions.

    The orchestrator owns a reference to the global :class:`AgentRegistry`
    and an optional :class:`~app.services.ai_gateway.AIGateway` for agents
    that need model access. It provides synchronous session management and
    asynchronous request routing.

    Args:
        gateway: Optional AI gateway instance. A default is created when
            omitted.
    """

    def __init__(self, gateway: AIGateway | None = None) -> None:
        self.registry: AgentRegistry = get_agent_registry()
        self.gateway = gateway or AIGateway()
        self._sessions: dict[str, AgentSession] = {}
        self._execution_logs: list[ExecutionLog] = []
        self._max_logs = 10_000
        self._fallback_index = 0

    async def execute(self, request: AgentRequest) -> AgentResponse:
        """Execute ``request`` against its target agent.

        Args:
            request: The :class:`AgentRequest` to process.

        Returns:
            An :class:`AgentResponse` from the target agent, or an error
            response if the agent is not found or raises an exception.
        """
        agent = self.registry.get_agent(request.agent_id)
        if agent is None:
            return AgentResponse(
                request_id=request.request_id,
                agent_id=request.agent_id,
                status="error",
                error=f"Agent '{request.agent_id}' not found",
            )

        start = time.perf_counter()
        try:
            response = await agent.process(request)
            response.request_id = request.request_id
            response.agent_id = request.agent_id
            return response
        except Exception as exc:
            logger.exception(
                "Agent %s failed to process request %s", request.agent_id, request.request_id
            )
            return AgentResponse(
                request_id=request.request_id,
                agent_id=request.agent_id,
                status="error",
                error=str(exc),
            )
        finally:
            latency = int((time.perf_counter() - start) * 1000)
            self._log_execution(
                request_id=request.request_id,
                agent_id=request.agent_id,
                status="completed",
                latency_ms=latency,
            )

    async def execute_with_fallback(self, request: AgentRequest) -> AgentResponse:
        """Execute ``request`` with automatic failover and load balancing.

        If the primary agent fails or is missing, the orchestrator selects a
        fallback agent with the same capability using round-robin load
        balancing.

        Args:
            request: The :class:`AgentRequest` to process.

        Returns:
            The first successful :class:`AgentResponse`, or an error response
            if all candidates fail.
        """
        primary = self.registry.get_agent(request.agent_id)
        if primary is None:
            return AgentResponse(
                request_id=request.request_id,
                agent_id=request.agent_id,
                status="error",
                error=f"Agent '{request.agent_id}' not found",
            )

        capabilities = primary.get_capabilities()
        fallback_candidates = self.registry.route_by_capability(
            next(iter(capabilities)) if capabilities else AgentCapability.tutoring
        )
        fallback_candidates = [
            a for a in fallback_candidates if a.get_metadata().agent_id != request.agent_id
        ]

        try:
            return await self.execute(request)
        except Exception as exc:
            logger.warning(
                "Primary agent %s failed: %s. Falling back.", request.agent_id, exc
            )

        if not fallback_candidates:
            return AgentResponse(
                request_id=request.request_id,
                agent_id=request.agent_id,
                status="error",
                error="No fallback agents available",
            )

        idx = self._fallback_index % len(fallback_candidates)
        self._fallback_index += 1
        fallback = fallback_candidates[idx]
        request.agent_id = fallback.get_metadata().agent_id
        return await self.execute(request)

    async def broadcast(self, event_name: str, data: dict[str, Any]) -> None:
        """Publish ``event_name`` to all registered agents via the event bus.

        Args:
            event_name: Name of the event to publish.
            data: Arbitrary event payload.
        """
        try:
            event_bus = get_event_bus()
            await event_bus.publish(Event(name=event_name, data=data))
        except Exception:
            logger.debug("Event bus unavailable; event %s not broadcast", event_name)

    def create_session(self, user_id: str, agent_ids: list[str]) -> AgentSession:
        """Create a new multi-agent session.

        Args:
            user_id: Owner of the session.
            agent_ids: Agents participating in the session.

        Returns:
            The newly created :class:`AgentSession`.
        """
        session_id = str(uuid.uuid4())
        session = AgentSession(
            session_id=session_id,
            user_id=user_id,
            agent_ids=agent_ids,
        )
        self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> AgentSession | None:
        """Retrieve a session by ``session_id``."""
        return self._sessions.get(session_id)

    async def send_message(
        self, session_id: str, message: str, agent_id: str | None = None
    ) -> AgentResponse:
        """Send a message to an active session.

        If ``agent_id`` is not provided, the first agent registered on the
        session is used.

        Args:
            session_id: Target session identifier.
            message: User message content.
            agent_id: Optional specific agent to handle the message.

        Returns:
            The :class:`AgentResponse` from the handling agent.
        """
        session = self._sessions.get(session_id)
        if session is None:
            return AgentResponse(
                request_id=str(uuid.uuid4()),
                agent_id=agent_id or "unknown",
                status="error",
                error=f"Session '{session_id}' not found",
            )
        if not session.active:
            return AgentResponse(
                request_id=str(uuid.uuid4()),
                agent_id=agent_id or "unknown",
                status="error",
                error="Session is not active",
            )

        session.add_message("user", message, agent_id)
        target_agent_id = agent_id or (session.agent_ids[0] if session.agent_ids else None)
        if target_agent_id is None:
            return AgentResponse(
                request_id=str(uuid.uuid4()),
                agent_id="unknown",
                status="error",
                error="No agent specified and session has no agents",
            )

        agent = self.registry.get_agent(target_agent_id)
        if agent is None:
            return AgentResponse(
                request_id=str(uuid.uuid4()),
                agent_id=target_agent_id,
                status="error",
                error=f"Agent '{target_agent_id}' not found",
            )

        request = AgentRequest(
            request_id=str(uuid.uuid4()),
            user_id=session.user_id,
            agent_id=target_agent_id,
            capability=next(iter(agent.get_capabilities())),
            payload={"message": message, "history": session.get_history(limit=20)},
            session_id=session_id,
            context=session.context,
        )

        response = await self.execute(request)
        if response.result:
            session.add_message("assistant", str(response.result), target_agent_id)
        return response

    def get_execution_logs(self, limit: int = 100) -> list[ExecutionLog]:
        """Return recent execution logs, newest last.

        Args:
            limit: Maximum number of logs to return.

        Returns:
            A list of :class:`ExecutionLog` entries.
        """
        return self._execution_logs[-limit:]

    def get_metrics(self) -> dict[str, Any]:
        """Return high-level orchestrator metrics.

        Returns:
            Dict with ``total_requests``, ``active_sessions``, and
            ``registered_agents`` counts.
        """
        return {
            "total_requests": len(self._execution_logs),
            "active_sessions": len([s for s in self._sessions.values() if s.active]),
            "registered_agents": self.registry.agent_count,
        }

    def _log_execution(
        self,
        request_id: str,
        agent_id: str,
        status: str,
        latency_ms: int,
        tokens_used: int = 0,
    ) -> None:
        """Persist an execution log entry, trimming if over limit."""
        self._execution_logs.append(
            ExecutionLog(
                request_id=request_id,
                agent_id=agent_id,
                status=status,
                latency_ms=latency_ms,
                tokens_used=tokens_used,
            )
        )
        if len(self._execution_logs) > self._max_logs:
            self._execution_logs = self._execution_logs[-self._max_logs :]
