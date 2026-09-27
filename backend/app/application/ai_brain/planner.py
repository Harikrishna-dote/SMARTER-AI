"""Planning engine for the AI Brain."""

from __future__ import annotations

import random
import string
from typing import Any

from app.domain.ai_brain import AgentCapability, ExecutionPlan, ExecutionStep, PlanStatus


class PlanningEngine:
    """Creates execution plans from user requests."""

    def create_plan(self, intent: str, context: dict[str, Any]) -> ExecutionPlan:
        steps = self._decompose(intent, context)
        plan_id = self._generate_plan_id()
        plan = ExecutionPlan(plan_id=plan_id, steps=steps)
        plan.metadata = {
            "intent": intent,
            "context_keys": list(context.keys()),
        }
        return plan

    async def review_and_adjust(self, plan: ExecutionPlan, execution_results: dict[str, Any]) -> ExecutionPlan:
        failed_steps = [step for step in plan.steps if step.status == PlanStatus.FAILED]
        for step in failed_steps:
            if self._is_retryable(step):
                step.status = PlanStatus.PENDING
                step.error = None
        return plan

    def _decompose(self, intent: str, context: dict[str, Any]) -> list[ExecutionStep]:
        steps: list[ExecutionStep] = []
        lower_intent = intent.lower()

        if any(keyword in lower_intent for keyword in ["translate", "translation"]):
            steps.append(self._step("translation", AgentCapability.TRANSLATION, {"intent": intent, **context}))
        if any(keyword in lower_intent for keyword in ["ocr", "scan", "camera", "image text"]):
            steps.append(self._step("ocr", AgentCapability.OCR, {"intent": intent, **context}))
        if any(keyword in lower_intent for keyword in ["quiz", "test", "assessment"]):
            steps.append(self._step("quiz", AgentCapability.QUIZ, {"intent": intent, **context}))
        if any(keyword in lower_intent for keyword in ["homework", "assignment"]):
            steps.append(self._step("homework", AgentCapability.HOMEWORK, {"intent": intent, **context}))
        if any(keyword in lower_intent for keyword in ["note", "summary", "summarize"]):
            steps.append(self._step("notes", AgentCapability.NOTES, {"intent": intent, **context}))
        if any(keyword in lower_intent for keyword in ["flashcard", "vocabulary", "word"]):
            steps.append(self._step("flashcard", AgentCapability.FLASHCARD, {"intent": intent, **context}))
        if any(keyword in lower_intent for keyword in ["voice", "speak", "listen", "pronunciation"]):
            steps.append(self._step("voice", AgentCapability.VOICE, {"intent": intent, **context}))
        if any(keyword in lower_intent for keyword in ["lesson", "teach", "learn", "explain"]):
            steps.append(self._step("teaching", AgentCapability.TEACHING, {"intent": intent, **context}))
        if any(keyword in lower_intent for keyword in ["recommend", "suggest", "next"]):
            steps.append(self._step("recommendation", AgentCapability.RECOMMENDATION, {"intent": intent, **context}))
        if any(keyword in lower_intent for keyword in ["progress", "analytics", "performance"]):
            steps.append(self._step("analytics", AgentCapability.ANALYTICS, {"intent": intent, **context}))

        if not steps:
            steps.append(self._step("teaching", AgentCapability.TEACHING, {"intent": intent, **context}))

        return steps

    def _step(self, step_id: str, capability: AgentCapability, input_data: dict[str, Any]) -> ExecutionStep:
        return ExecutionStep(step_id=step_id, agent_capability=capability, input=input_data)

    def _generate_plan_id(self) -> str:
        return "plan_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=12))

    def _is_retryable(self, step: ExecutionStep) -> bool:
        if step.error is None:
            return False
        retryable_patterns = ["timeout", "rate limit", "temporary", "503", "502", "429"]
        return any(pattern in step.error.lower() for pattern in retryable_patterns)
