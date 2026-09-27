"""Agent marketplace API routes."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import AgentCapability, AgentCategory, BaseAgent
from app.agents.agent_manager import AgentManager, AgentSession
from app.agents.registry import AgentRegistry, get_agent_registry
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.ai_gateway import AIGateway

logger = logging.getLogger(__name__)

router = APIRouter()


def get_agent_manager() -> AgentManager:
    """Provide the marketplace agent manager."""
    return AgentManager()


@router.get("", response_model=list[dict[str, Any]])
async def list_agents(
    capability: str | None = None,
    category: str | None = None,
    current_user: User = Depends(get_current_user),
    agent_manager: AgentManager = Depends(get_agent_manager),
) -> list[dict[str, Any]]:
    """List all available marketplace agents.

    Args:
        capability: Optional capability filter.
        category: Optional category filter.
        current_user: Authenticated user from JWT.
        agent_manager: Agent manager dependency.

    Returns:
        A list of agent metadata summaries.
    """
    agents = agent_manager.get_all_agents()
    if capability:
        try:
            cap = AgentCapability(capability)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid capability: {capability}") from exc
        agents = [a for a in agents if cap in a.get_capabilities()]
    if category:
        try:
            cat = AgentCategory(category)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}") from exc
        agents = [a for a in agents if a.get_metadata().category == cat]
    return [_serialize_metadata(a.get_metadata()) for a in agents]


@router.get("/{agent_id}", response_model=dict[str, Any])
async def get_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    agent_manager: AgentManager = Depends(get_agent_manager),
) -> dict[str, Any]:
    """Get detailed information about a specific agent.

    Args:
        agent_id: Target agent identifier.
        current_user: Authenticated user from JWT.
        agent_manager: Agent manager dependency.

    Returns:
        Detailed agent metadata.

    Raises:
        HTTPException: 404 if the agent is not found.
    """
    agent = agent_manager.registry.get_agent(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _serialize_metadata(agent.get_metadata(), detailed=True)


@router.post("/{agent_id}/execute")
async def execute_agent(
    agent_id: str,
    payload: dict[str, Any],
    current_user: User = Depends(get_current_user),
    agent_manager: AgentManager = Depends(get_agent_manager),
) -> dict[str, Any]:
    """Execute a request against a specific agent.

    Args:
        agent_id: Target agent identifier.
        payload: Agent-specific input data.
        current_user: Authenticated user from JWT.
        agent_manager: Agent manager dependency.

    Returns:
        The agent's :class:`~app.agents.base.AgentResponse` envelope.

    Raises:
        HTTPException: 404 if the agent is not found.
    """
    agent = agent_manager.registry.get_agent(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    request_id = str(uuid.uuid4())
    capabilities = agent.get_capabilities()
    request = AgentRequest(
        request_id=request_id,
        user_id=current_user.id,
        agent_id=agent_id,
        capability=next(iter(capabilities)) if capabilities else AgentCapability.tutoring,
        payload=payload,
        context={},
    )
    response = await agent_manager.execute(request)
    return _serialize_response(response)


@router.get("/capabilities", response_model=list[str])
async def list_capabilities(
    current_user: User = Depends(get_current_user),
    agent_manager: AgentManager = Depends(get_agent_manager),
) -> list[str]:
    """List all capabilities available in the marketplace.

    Args:
        current_user: Authenticated user from JWT.
        agent_manager: Agent manager dependency.

    Returns:
        A list of capability strings.
    """
    registry = get_agent_registry()
    return sorted(c.value for c in registry.get_capabilities())


@router.post("/sessions", response_model=dict[str, Any])
async def create_session(
    payload: dict[str, Any],
    current_user: User = Depends(get_current_user),
    agent_manager: AgentManager = Depends(get_agent_manager),
) -> dict[str, Any]:
    """Create a new multi-agent session.

    Args:
        payload: JSON body containing ``agent_ids`` list.
        current_user: Authenticated user from JWT.
        agent_manager: Agent manager dependency.

    Returns:
        Session metadata including ``session_id``.
    """
    agent_ids: list[str] = payload.get("agent_ids", [])
    session = agent_manager.create_session(user_id=current_user.id, agent_ids=agent_ids)
    return {
        "session_id": session.session_id,
        "user_id": session.user_id,
        "agent_ids": session.agent_ids,
        "created_at": session.created_at,
    }


@router.post("/sessions/{session_id}/message")
async def send_message(
    session_id: str,
    payload: dict[str, Any],
    current_user: User = Depends(get_current_user),
    agent_manager: AgentManager = Depends(get_agent_manager),
) -> dict[str, Any]:
    """Send a message to an existing session.

    Args:
        session_id: Target session identifier.
        payload: JSON body containing ``message`` and optional ``agent_id``.
        current_user: Authenticated user from JWT.
        agent_manager: Agent manager dependency.

    Returns:
        The agent's response envelope.

    Raises:
        HTTPException: 400 if ``message`` is missing.
    """
    message = payload.get("message", "")
    agent_id = payload.get("agent_id")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    response = await agent_manager.send_message(session_id, message, agent_id)
    return _serialize_response(response)


def _serialize_metadata(metadata: Any, detailed: bool = False) -> dict[str, Any]:
    """Convert :class:`~app.agents.base.AgentMetadata` to a JSON-safe dict."""
    base: dict[str, Any] = {
        "agent_id": metadata.agent_id,
        "name": metadata.name,
        "version": metadata.version,
        "description": metadata.description,
        "capabilities": [c.value for c in metadata.capabilities],
        "author": metadata.author,
        "supported_languages": metadata.supported_languages,
        "difficulty_levels": [d.value for d in metadata.difficulty_levels],
        "category": metadata.category.value,
    }
    if detailed:
        base.update(
            {
                "tags": getattr(metadata, "tags", []),
                "icon_url": getattr(metadata, "icon_url", None),
                "documentation_url": getattr(metadata, "documentation_url", None),
            }
        )
    return base


def _serialize_response(response: AgentResponse) -> dict[str, Any]:
    """Convert :class:`~app.agents.base.AgentResponse` to a JSON-safe dict."""
    return {
        "request_id": response.request_id,
        "agent_id": response.agent_id,
        "status": response.status,
        "result": response.result,
        "error": response.error,
        "metadata": response.metadata,
        "tokens_used": response.tokens_used,
        "latency_ms": response.latency_ms,
    }
