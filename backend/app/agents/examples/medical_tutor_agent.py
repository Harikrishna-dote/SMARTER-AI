"""Example specialized agent: Medical Tutor.

This agent demonstrates how to implement :class:`~app.agents.base.BaseAgent`
for a domain-specific tutoring use case. It integrates with the existing
:class:`~app.services.ai_gateway.AIGateway` to provide structured medical
education assistance.
"""

from __future__ import annotations

import logging
from typing import Any

from app.agents.base import (
    AgentCapability,
    AgentCategory,
    AgentMetadata,
    AgentRequest,
    AgentResponse,
    BaseAgent,
)
from app.services.ai_gateway import AIGateway

logger = logging.getLogger(__name__)


class MedicalTutorAgent(BaseAgent):
    """AI tutor specialized in medical education.

    Provides structured explanations for anatomy, physiology, pharmacology,
    and clinical reasoning. Integrates with the AI gateway for model access
    and includes appropriate medical disclaimers.
    """

    metadata = AgentMetadata(
        agent_id="medical_tutor_v1",
        name="Medical Tutor",
        version="1.0.0",
        description=(
            "Specialized AI tutor for medical education covering anatomy, "
            "physiology, pharmacology, and clinical reasoning. Provides "
            "structured explanations with evidence-based references and "
            "clinical correlations."
        ),
        capabilities=frozenset([AgentCapability.tutoring, AgentCapability.research]),
        author="SMARTER-AI",
        supported_languages=["en", "te", "hi"],
        difficulty_levels=["beginner", "intermediate", "advanced"],
        category=AgentCategory.healthcare,
    )

    def __init__(self, gateway: AIGateway | None = None) -> None:
        """Initialize the medical tutor with an optional gateway override."""
        self.gateway = gateway or AIGateway()

    async def process(self, request: AgentRequest) -> AgentResponse:
        """Process a medical tutoring request.

        Args:
            request: The :class:`AgentRequest` containing the user's query.

        Returns:
            An :class:`AgentResponse` with the tutor's explanation.
        """
        system_prompt = (
            "You are a medical education tutor. Provide accurate, structured "
            "explanations suitable for students and professionals. When "
            "appropriate, include clinical correlations and evidence-based "
            "references. Always conclude with a brief disclaimer that this "
            "is for educational purposes only."
        )
        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]

        if request.context.get("history"):
            messages.extend(request.context["history"][-10:])

        user_content = request.payload.get("message", "")
        if not user_content:
            return AgentResponse(
                request_id=request.request_id,
                agent_id=self.metadata.agent_id,
                status="error",
                error="Empty message payload",
            )
        messages.append({"role": "user", "content": user_content})

        try:
            response_text = await self.gateway.chat(
                messages,
                model=request.payload.get("model"),
                temperature=request.payload.get("temperature", 0.35),
                max_output_tokens=request.payload.get("max_tokens"),
            )
            return AgentResponse(
                request_id=request.request_id,
                agent_id=self.metadata.agent_id,
                status="success",
                result=response_text,
                metadata={"domain": "medical_education"},
            )
        except Exception as exc:
            logger.exception("MedicalTutorAgent failed to process request %s", request.request_id)
            return AgentResponse(
                request_id=request.request_id,
                agent_id=self.metadata.agent_id,
                status="error",
                error=str(exc),
            )

    def get_capabilities(self) -> frozenset[AgentCapability]:
        """Return the capabilities supported by this agent."""
        return self.metadata.capabilities

    def get_metadata(self) -> AgentMetadata:
        """Return the static metadata for this agent."""
        return self.metadata

    async def health_check(self) -> dict[str, Any]:
        """Verify the agent can reach the AI gateway.

        Returns:
            A dict with ``status`` (``healthy`` or ``unhealthy``) and
            optional ``error`` details.
        """
        try:
            await self.gateway.chat(
                [{"role": "user", "content": "ping"}],
                max_output_tokens=5,
            )
            return {"status": "healthy", "agent_id": self.metadata.agent_id}
        except Exception as exc:
            return {
                "status": "unhealthy",
                "agent_id": self.metadata.agent_id,
                "error": str(exc),
            }
