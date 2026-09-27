"""Base agent abstractions for the AI Agent Marketplace.

Every specialized agent extends :class:`BaseAgent` and exposes an
:class:`AgentMetadata` instance. The metadata describes the agent identity,
capabilities, and supported domains so the registry and orchestrator can
route and execute requests without the core importing agent modules directly.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class AgentCapability(str, Enum):
    """Supported agent capabilities in the marketplace."""

    tutoring = "tutoring"
    assessment = "assessment"
    translation = "translation"
    vision = "vision"
    voice = "voice"
    coding = "coding"
    career_guidance = "career_guidance"
    research = "research"
    interview_prep = "interview_prep"
    mentoring = "mentoring"


class AgentCategory(str, Enum):
    """High-level classification for marketplace agents."""

    education = "education"
    healthcare = "healthcare"
    technology = "technology"
    business = "business"
    creative = "creative"
    research = "research"
    general = "general"


class DifficultyLevel(str, Enum):
    """Learning difficulty levels supported by an agent."""

    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"
    expert = "expert"


@dataclass(frozen=True, slots=True)
class AgentMetadata:
    """Static descriptive information about a marketplace agent.

    Attributes:
        agent_id: Unique identifier for the agent.
        name: Human-readable agent name.
        version: Semantic version string.
        description: Human-readable summary of the agent.
        capabilities: Set of :class:`AgentCapability` values the agent supports.
        author: Agent maintainer or organization.
        supported_languages: List of language codes the agent supports (e.g. ``["en", "te"]``).
        difficulty_levels: List of :class:`DifficultyLevel` values the agent covers.
        category: One of :class:`AgentCategory`.
    """

    agent_id: str
    name: str
    version: str
    description: str
    capabilities: frozenset[AgentCapability]
    author: str
    supported_languages: list[str]
    difficulty_levels: list[DifficultyLevel]
    category: AgentCategory


@dataclass(slots=True)
class AgentRequest:
    """Request envelope sent to an agent for processing.

    Attributes:
        request_id: Unique request identifier.
        user_id: ID of the requesting user.
        agent_id: Target agent identifier.
        capability: Primary capability being invoked.
        payload: Agent-specific input data.
        context: Optional execution context (history, preferences, etc.).
        session_id: Optional session identifier for multi-turn conversations.
    """

    request_id: str
    user_id: str
    agent_id: str
    capability: AgentCapability
    payload: dict[str, Any]
    context: dict[str, Any] = field(default_factory=dict)
    session_id: str | None = None


@dataclass(slots=True)
class AgentResponse:
    """Response envelope returned by an agent after processing.

    Attributes:
        request_id: Corresponding request identifier.
        agent_id: Agent that produced the response.
        status: Execution status (``success`` or ``error``).
        result: Agent-specific result payload.
        error: Error message if status is ``error``.
        metadata: Additional execution metadata.
        tokens_used: Estimated token consumption.
        latency_ms: Execution latency in milliseconds.
    """

    request_id: str
    agent_id: str
    status: str
    result: Any = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    tokens_used: int = 0
    latency_ms: int = 0


class BaseAgent(ABC):
    """Abstract base class every marketplace agent must implement.

    The lifecycle is intentionally small:

    1. :meth:`process` executes the agent logic for a given request.
    2. :meth:`get_capabilities` advertises supported capabilities.
    3. :meth:`get_metadata` exposes static agent metadata.
    4. :meth:`health_check` reports agent health status.
    """

    metadata: AgentMetadata

    async def process(self, request: AgentRequest) -> AgentResponse:
        """Process an agent request and return a response.

        Args:
            request: The :class:`AgentRequest` to process.

        Returns:
            An :class:`AgentResponse` containing the result or error.
        """
        raise NotImplementedError

    @abstractmethod
    def get_capabilities(self) -> frozenset[AgentCapability]:
        """Return the set of capabilities this agent supports."""
        ...

    @abstractmethod
    def get_metadata(self) -> AgentMetadata:
        """Return the agent's static metadata."""
        ...

    @abstractmethod
    async def health_check(self) -> dict[str, Any]:
        """Return a health status dict for this agent."""
        ...
