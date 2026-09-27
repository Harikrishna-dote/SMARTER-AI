import asyncio
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.application.orchestrator import AIOrchestrator  # noqa: E402
from app.application.ai_brain.brain import AIBrain  # noqa: E402
from app.application.ai_brain.registry import AgentRegistry  # noqa: E402
from app.domain.ai_brain import AgentCapability, ExecutionPlan, ExecutionStep  # noqa: E402


class _Agent:
    def __init__(self, value: str, delay: float = 0.0, fail: bool = False):
        self.value = value
        self.delay = delay
        self.fail = fail

    async def execute(self, _user_id, payload):
        await asyncio.sleep(self.delay)
        if self.fail:
            raise RuntimeError(f"{self.value} unavailable")
        return {"value": self.value, "topic": payload.get("topic")}


@pytest.mark.asyncio
async def test_orchestrator_reports_independent_multi_agent_results():
    orchestrator = AIOrchestrator.__new__(AIOrchestrator)
    orchestrator.user_id = "student-1"
    orchestrator._agents = {
        "notes": _Agent("notes", delay=0.02),
        "quiz": _Agent("quiz", delay=0.01),
        "voice": _Agent("voice", fail=True),
    }

    result = await orchestrator.run_multi_agent([
        {"id": "notes", "agent": "notes", "payload": {"topic": "motion"}},
        {"id": "quiz", "agent": "quiz", "payload": {"topic": "motion"}},
        {"id": "voice", "agent": "voice", "payload": {"topic": "motion"}},
    ])

    assert result["status"] == "partial"
    assert result["results"]["notes"]["output"]["value"] == "notes"
    assert result["results"]["quiz"]["output"]["value"] == "quiz"
    assert result["results"]["voice"]["status"] == "failed"


class _BrainAgent:
    def __init__(self, name: str):
        self.name = name

    async def execute(self, step, _context):
        await asyncio.sleep(0.01)
        return {"content": self.name}


class _Plan:
    def create_plan(self, _intent, _context):
        return ExecutionPlan(
            "plan-test",
            [
                ExecutionStep("notes", AgentCapability.NOTES, {}),
                ExecutionStep("quiz", AgentCapability.QUIZ, {}),
            ],
        )


@pytest.mark.asyncio
async def test_ai_brain_executes_independent_plan_steps_as_one_multi_agent_wave():
    registry = AgentRegistry()
    registry.register(AgentCapability.NOTES, plugin=_BrainAgent("notes"))
    registry.register(AgentCapability.QUIZ, plugin=_BrainAgent("quiz"))
    brain = AIBrain(registry=registry, planning_engine=_Plan())

    result = await brain.process_request("make notes and a quiz", {})

    assert result["plan"]["metadata"]["execution_mode"] == "dependency_aware_multi_agent"
    assert result["results"]["notes"]["content"] == "notes"
    assert result["results"]["quiz"]["content"] == "quiz"
