"""Central AI Brain orchestrator."""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any

from app.application.ai_brain.planner import PlanningEngine
from app.application.ai_brain.rag import RAGPipeline
from app.application.ai_brain.registry import AgentRegistry
from app.application.ai_brain.reviewer import SelfReviewEngine
from app.domain.ai_brain import AgentCapability, ExecutionPlan, ExecutionStep, PlanStatus


class AIBrain:
    """Central AI Brain that coordinates all agents, memory, and knowledge."""

    def __init__(
        self,
        registry: AgentRegistry | None = None,
        planning_engine: PlanningEngine | None = None,
        review_engine: SelfReviewEngine | None = None,
        rag_pipeline: RAGPipeline | None = None,
    ) -> None:
        self.registry = registry or AgentRegistry()
        self.planner = planning_engine or PlanningEngine()
        self.reviewer = review_engine or SelfReviewEngine()
        self.rag = rag_pipeline or RAGPipeline()

    async def process_request(self, intent: str, context: dict[str, Any]) -> dict[str, Any]:
        plan = self.planner.create_plan(intent, context)
        plan.status = PlanStatus.EXECUTING
        results: dict[str, Any] = {}

        # Independent specialist tasks run concurrently. Dependencies are
        # respected in waves, so a later agent can consume an earlier result
        # without serializing unrelated voice, notes, quiz, or retrieval work.
        pending = list(plan.steps)
        plan.metadata["execution_mode"] = "dependency_aware_multi_agent"
        while pending:
            ready = [step for step in pending if all(dependency in results for dependency in step.dependencies)]
            if not ready:
                for step in pending:
                    step.status = PlanStatus.FAILED
                    step.error = "Unresolved agent dependency"
                    results[step.step_id] = {"error": step.error}
                break

            pending = [step for step in pending if step not in ready]
            runnable: list[Any] = []
            for step in ready:
                failed_dependencies = [dependency for dependency in step.dependencies if "error" in results.get(dependency, {})]
                if failed_dependencies:
                    step.status = PlanStatus.FAILED
                    step.error = f"Dependency failed: {', '.join(failed_dependencies)}"
                    results[step.step_id] = {"error": step.error}
                else:
                    runnable.append(self.registry.execute_step(step, context))

            if runnable:
                outputs = await asyncio.gather(*runnable, return_exceptions=True)
                runnable_steps = [step for step in ready if step.status != PlanStatus.FAILED]
                for step, output in zip(runnable_steps, outputs):
                    if isinstance(output, Exception):
                        step.status = PlanStatus.FAILED
                        step.error = str(output)
                        results[step.step_id] = {"error": str(output)}
                    else:
                        step.status = PlanStatus.COMPLETED
                        results[step.step_id] = output

        plan.status = PlanStatus.COMPLETED
        final_response = await self._synthesize_response(plan, results, context)
        return {
            "plan": plan.to_dict(),
            "results": results,
            "response": final_response,
        }

    async def _synthesize_response(self, plan: ExecutionPlan, results: dict[str, Any], context: dict[str, Any]) -> str:
        successful = [r for r in results.values() if "error" not in r]
        if not successful:
            return "I'm sorry, I couldn't process that request. Please try again."

        parts: list[str] = []
        for step_id, result in results.items():
            if "error" not in result:
                content = result.get("translated_content") or result.get("content") or result.get("output", "")
                if content:
                    parts.append(str(content))

        response = "\n\n".join(parts) if parts else "Request processed successfully."
        review = await self.reviewer.review(response, context)
        if not review.passed:
            response = self._apply_suggestions(response, review.suggestions)
        return response

    def _apply_suggestions(self, response: str, suggestions: list[str]) -> str:
        if not suggestions:
            return response
        return response + "\n\n(Note: " + "; ".join(suggestions) + ")"
