import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["AUTO_CREATE_TABLES"] = "false"

from app.application.memory_engine import MemoryEngine
from app.domain.memory import (
    MasteryState,
    MemoryLayer,
    canonical_memory_key,
    estimate_mastery_state,
    next_review_interval_days,
    should_store_conversation_memory,
)
from app.models.memory import MemoryItem


class FakeDb:
    def __init__(self):
        self.added = []

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        return None


class FakeRepo:
    def __init__(self, memories=None):
        self.memories = memories or []
        self.db = FakeDb()

    async def get_by_key(self, user_id, key):
        return next((memory for memory in self.memories if memory.user_id == user_id and memory.key == key), None)

    async def search(self, user_id, query, limit=8):
        return [memory for memory in self.memories if memory.user_id == user_id][:limit]


class FakeKnowledgeGraph:
    def describe_concept(self, topic):
        return "Deep learning model." if topic == "neural_networks" else ""

    def get_prerequisites(self, topic):
        return ["python", "matrices"] if topic == "neural_networks" else []

    def learning_path(self, topic):
        return ["python", "matrices", topic]


def _memory(key: str, value: str, source: str = "auto-tutor") -> MemoryItem:
    return MemoryItem(user_id="user-1", key=key, value=value, source=source)


def test_memory_policy_canonicalizes_layers_and_mastery():
    assert canonical_memory_key(MemoryLayer.PREFERENCE, "Tutor Profile") == "preference:tutor_profile"
    assert estimate_mastery_state(42) == MasteryState.LEARNING
    assert estimate_mastery_state(88) == MasteryState.CONFIDENT
    assert next_review_interval_days(MasteryState.MASTERED, successful_reviews=2) == 42


def test_conversation_memory_stores_only_durable_signals():
    assert should_store_conversation_memory("ok") is False
    assert should_store_conversation_memory("Remember that my goal is to prepare for the data science interview.") is True


@pytest.mark.asyncio
async def test_memory_engine_formats_retrieval_by_layer():
    repo = FakeRepo(
        [
            _memory("preference:tutor_profile", "language=Telugu; response_style=step_by_step"),
            _memory("learning:mastery:neural_networks", "mastery=partially_understood; review_on=2026-08-10"),
            _memory("knowledge:lesson:matrices", "Matrix notes"),
        ]
    )
    engine = MemoryEngine(repo, FakeKnowledgeGraph())

    context = await engine.build_retrieval_context("user-1", "neural networks")
    prompt_context = context.format_for_prompt()

    assert "Preference memory:" in prompt_context
    assert "Learning memory:" in prompt_context
    assert "Knowledge memory:" in prompt_context
    assert "neural_networks prerequisites: python, matrices" in prompt_context


@pytest.mark.asyncio
async def test_memory_engine_updates_existing_layer_record():
    existing = _memory("learning:mastery:algebra", "old")
    repo = FakeRepo([existing])
    engine = MemoryEngine(repo, FakeKnowledgeGraph())

    item = await engine.remember_layer(
        "user-1",
        MemoryLayer.LEARNING,
        "mastery:algebra",
        "new",
        source="classroom-progress",
    )

    assert item is existing
    assert item.value == "new"
    assert repo.db.added == [existing]

