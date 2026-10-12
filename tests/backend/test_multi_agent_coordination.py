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


@pytest.mark.asyncio
async def test_database_agents_receive_distinct_sessions():
    orchestrator = AIOrchestrator.__new__(AIOrchestrator)
    orchestrator.user_id = "student-1"
    orchestrator.settings = type("Settings", (), {"max_parallel_agent_tasks": 4})()
    orchestrator._agents = {}
    sessions = []

    class Session:
        async def __aenter__(self):
            sessions.append(self)
            return self

        async def __aexit__(self, *_args):
            return False

        async def rollback(self):
            return None

    class SessionFactory:
        def __call__(self):
            return Session()

    class Scoped:
        def __init__(self, session):
            self.session = session

        async def run_agent(self, name, payload):
            return {"name": name, "session": self.session}

    def scoped_for_session(session):
        return Scoped(session)

    orchestrator._scoped_for_session = scoped_for_session
    orchestrator.session_factory = SessionFactory()

    result = await orchestrator.run_multi_agent([
        {"id": "memory-a", "agent": "memory", "payload": {}},
        {"id": "memory-b", "agent": "memory", "payload": {}},
    ])

    assert result["status"] == "completed"
    assert len(sessions) == 2
    assert sessions[0] is not sessions[1]
    assert result["results"]["memory-a"]["output"]["session"] in sessions
    assert result["results"]["memory-b"]["output"]["session"] in sessions


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
