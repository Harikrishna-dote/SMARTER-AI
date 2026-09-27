"""Framework-free memory and personalization policy."""

from dataclasses import dataclass, field
from enum import StrEnum


class MemoryLayer(StrEnum):
    SESSION = "session"
    CONVERSATION = "conversation"
    LEARNING = "learning"
    PREFERENCE = "preference"
    KNOWLEDGE = "knowledge"
    VECTOR = "vector"


class MasteryState(StrEnum):
    NOT_STARTED = "not_started"
    LEARNING = "learning"
    PARTIALLY_UNDERSTOOD = "partially_understood"
    UNDERSTOOD = "understood"
    CONFIDENT = "confident"
    MASTERED = "mastered"


@dataclass(frozen=True)
class LearningMemoryRecord:
    layer: MemoryLayer
    key: str
    value: str
    source: str = "system"
    importance: float = 0.5


@dataclass(frozen=True)
class RetrievalContext:
    query: str
    records: tuple[LearningMemoryRecord, ...] = field(default_factory=tuple)
    knowledge_graph_notes: tuple[str, ...] = field(default_factory=tuple)

    def format_for_prompt(self) -> str:
        if not self.records and not self.knowledge_graph_notes:
            return ""

        lines = [
            "Retrieved learning intelligence:",
            "Use this as stored personalization and trusted retrieval context, not as model training.",
        ]
        if self.knowledge_graph_notes:
            lines.append("Knowledge graph:")
            lines.extend(f"- {note}" for note in self.knowledge_graph_notes)

        grouped: dict[MemoryLayer, list[LearningMemoryRecord]] = {}
        for record in self.records:
            grouped.setdefault(record.layer, []).append(record)

        for layer in MemoryLayer:
            records = grouped.get(layer, [])
            if not records:
                continue
            lines.append(f"{layer.value.title()} memory:")
            lines.extend(f"- {record.key}: {record.value} (source: {record.source})" for record in records)
        return "\n".join(lines)


def canonical_memory_key(layer: MemoryLayer, key: str) -> str:
    clean_key = ":".join(part.strip().lower().replace(" ", "_") for part in key.split(":") if part.strip())
    return f"{layer.value}:{clean_key or 'default'}"


def parse_memory_layer(key: str, source: str = "") -> MemoryLayer:
    prefix = key.split(":", 1)[0].lower()
    for layer in MemoryLayer:
        if prefix == layer.value:
            return layer
    source_text = source.lower()
    if "preference" in source_text or "settings" in source_text:
        return MemoryLayer.PREFERENCE
    if "document" in source_text or "notes" in source_text or "lesson" in source_text:
        return MemoryLayer.KNOWLEDGE
    if "tutor" in source_text or "learning" in source_text:
        return MemoryLayer.LEARNING
    return MemoryLayer.CONVERSATION


def should_store_conversation_memory(content: str) -> bool:
    text = " ".join(content.split())
    if len(text) < 40:
        return False
    lower = text.lower()
    durable_markers = {
        "my goal",
        "i want to learn",
        "i prefer",
        "remember",
        "exam",
        "project",
        "weak",
        "strong",
        "confused",
        "homework",
        "assignment",
        "career",
    }
    return any(marker in lower for marker in durable_markers)


def estimate_mastery_state(score: float | None) -> MasteryState:
    if score is None:
        return MasteryState.LEARNING
    if score < 20:
        return MasteryState.NOT_STARTED
    if score < 45:
        return MasteryState.LEARNING
    if score < 70:
        return MasteryState.PARTIALLY_UNDERSTOOD
    if score < 85:
        return MasteryState.UNDERSTOOD
    if score < 95:
        return MasteryState.CONFIDENT
    return MasteryState.MASTERED


def next_review_interval_days(mastery: MasteryState, successful_reviews: int = 0) -> int:
    base_days = {
        MasteryState.NOT_STARTED: 1,
        MasteryState.LEARNING: 1,
        MasteryState.PARTIALLY_UNDERSTOOD: 2,
        MasteryState.UNDERSTOOD: 4,
        MasteryState.CONFIDENT: 7,
        MasteryState.MASTERED: 14,
    }[mastery]
    return min(60, base_days * max(1, successful_reviews + 1))

