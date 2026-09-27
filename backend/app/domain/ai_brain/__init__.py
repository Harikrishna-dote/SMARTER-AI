"""Core domain models for the AI Brain."""

from __future__ import annotations

from enum import Enum
from typing import Any


class AgentCapability(str, Enum):
    TEACHING = "teaching"
    LESSON_PLANNING = "lesson_planning"
    MEMORY = "memory"
    VOICE = "voice"
    TRANSLATION = "translation"
    OCR = "ocr"
    ANIMATION = "animation"
    WHITEBOARD = "whiteboard"
    IMAGE_GENERATION = "image_generation"
    DIAGRAM = "diagram"
    QUIZ = "quiz"
    HOMEWORK = "homework"
    NOTES = "notes"
    FLASHCARD = "flashcard"
    CODING = "coding"
    MATHEMATICS = "mathematics"
    SCIENCE = "science"
    RESEARCH = "research"
    CAREER_GUIDANCE = "career_guidance"
    ANALYTICS = "analytics"
    RECOMMENDATION = "recommendation"
    PROGRESS = "progress"
    KNOWLEDGE_RETRIEVAL = "knowledge_retrieval"
    SAFETY_VALIDATION = "safety_validation"


class MemoryLayer(str, Enum):
    SESSION = "session"
    CONVERSATION = "conversation"
    LEARNING = "learning"
    PREFERENCE = "preference"
    KNOWLEDGE = "knowledge"
    VECTOR = "vector"


class PlanStatus(str, Enum):
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExecutionStep:
    def __init__(
        self,
        step_id: str,
        agent_capability: AgentCapability,
        input: dict[str, Any],
        dependencies: list[str] | None = None,
    ) -> None:
        self.step_id = step_id
        self.agent_capability = agent_capability
        self.input = input
        self.dependencies = dependencies or []
        self.output: dict[str, Any] | None = None
        self.status: PlanStatus = PlanStatus.PENDING
        self.error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "step_id": self.step_id,
            "agent_capability": self.agent_capability.value,
            "input": self.input,
            "dependencies": self.dependencies,
            "output": self.output,
            "status": self.status.value,
            "error": self.error,
        }


class ExecutionPlan:
    def __init__(self, plan_id: str, steps: list[ExecutionStep]) -> None:
        self.plan_id = plan_id
        self.steps = steps
        self.status: PlanStatus = PlanStatus.PENDING
        self.created_at: str = ""
        self.metadata: dict[str, Any] = {}

    def get_step(self, step_id: str) -> ExecutionStep | None:
        for step in self.steps:
            if step.step_id == step_id:
                return step
        return None

    def to_dict(self) -> dict[str, Any]:
        return {
            "plan_id": self.plan_id,
            "steps": [step.to_dict() for step in self.steps],
            "status": self.status.value,
            "created_at": self.created_at,
            "metadata": self.metadata,
        }


class AgentMessage:
    def __init__(
        self,
        sender: str,
        recipient: str,
        payload: dict[str, Any],
        conversation_id: str | None = None,
    ) -> None:
        self.sender = sender
        self.recipient = recipient
        self.payload = payload
        self.conversation_id = conversation_id
        self.timestamp: str = ""
        self.response: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "sender": self.sender,
            "recipient": self.recipient,
            "payload": self.payload,
            "conversation_id": self.conversation_id,
            "timestamp": self.timestamp,
            "response": self.response,
        }
