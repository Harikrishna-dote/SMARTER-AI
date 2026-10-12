"""Explainable learning intelligence used by the classroom and tutor.

This module deliberately uses a small deterministic baseline.  It classifies
the current request, chooses a trusted visualization family, and updates a
topic estimate from explicit assessment evidence.  It does not infer age,
personality, disability, or intelligence from free-form conversation.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Mapping


class MasteryStatus(StrEnum):
    NOT_ASSESSED = "not_assessed"
    LEARNING = "learning"
    DEVELOPING = "developing"
    DEMONSTRATED_MASTERY = "demonstrated_mastery"
    NEEDS_REVISION = "needs_revision"


class VisualStrategy(StrEnum):
    DIAGRAM = "diagram"
    FLOWCHART = "flowchart"
    CODE_TRACE = "code_trace"
    MATH_GRAPH = "math_graph"
    SIMULATION = "simulation"
    TIMELINE = "timeline"
    NETWORK = "network"


@dataclass(frozen=True)
class LearningClassification:
    subject: str
    topic: str
    task: str
    visual_strategy: VisualStrategy
    variables: tuple[str, ...]
    validation_requirements: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "subject": self.subject,
            "topic": self.topic,
            "task": self.task,
            "visual_strategy": self.visual_strategy.value,
            "variables": list(self.variables),
            "validation_requirements": list(self.validation_requirements),
        }


_SUBJECT_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("programming", ("python", "javascript", "java", "sql", "code", "program", "algorithm", "loop", "recursion", "api")),
    ("mathematics", ("algebra", "equation", "function", "calculus", "geometry", "trigonometry", "probability", "statistics", "matrix", "vector")),
    ("physics", ("force", "motion", "velocity", "acceleration", "gravity", "energy", "wave", "circuit", "voltage", "current")),
    ("chemistry", ("atom", "molecule", "reaction", "bond", "acid", "base", "periodic", "oxidation")),
    ("biology", ("cell", "dna", "gene", "organ", "photosynthesis", "ecosystem", "anatomy")),
    ("history", ("history", "war", "revolution", "empire", "constitution", "independence", "dynasty")),
    ("geography", ("geography", "climate", "river", "mountain", "population", "continent", "map")),
)

_TASK_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("solve", ("solve", "calculate", "find", "derive", "debug", "fix")),
    ("practice", ("practice", "exercise", "problem", "quiz", "test")),
    ("revise", ("revise", "revision", "summarize", "summary", "remember")),
    ("compare", ("difference", "compare", "versus", " vs ")),
    ("explain", ("explain", "how", "what", "why", "teach", "understand")),
)


def normalize_topic(value: str) -> str:
    """Create a stable topic key without storing a student's raw message."""

    return " ".join(re.findall(r"[\w.+#-]+", (value or "").strip().lower()))[:180]


def _contains(text: str, term: str) -> bool:
    return re.search(rf"(?<!\w){re.escape(term)}(?!\w)", text) is not None


def _subject_for(text: str, requested: str) -> str:
    requested_text = (requested or "").strip().lower()
    if requested_text and requested_text not in {"general", "adaptive", "unknown"}:
        return requested_text
    for subject, terms in _SUBJECT_RULES:
        if any(_contains(text, term) for term in terms):
            return subject
    return "general"


def _visual_for(subject: str, text: str) -> VisualStrategy:
    if subject == "programming" or any(_contains(text, term) for term in ("code", "algorithm", "loop", "recursion", "debug")):
        return VisualStrategy.CODE_TRACE
    if subject == "mathematics" or any(_contains(text, term) for term in ("equation", "function", "graph", "geometry")):
        return VisualStrategy.MATH_GRAPH
    if subject in {"physics", "chemistry"}:
        return VisualStrategy.SIMULATION
    if subject == "biology":
        return VisualStrategy.DIAGRAM
    if subject == "history":
        return VisualStrategy.TIMELINE
    if any(_contains(text, term) for term in ("network", "routing", "packet", "architecture", "system")):
        return VisualStrategy.NETWORK
    if any(_contains(text, term) for term in ("process", "workflow", "steps", "procedure")):
        return VisualStrategy.FLOWCHART
    return VisualStrategy.DIAGRAM


def classify_learning_request(message: str, subject: str = "general", topic: str | None = None) -> LearningClassification:
    """Classify a request with bounded rules and a trusted visual strategy."""

    text = " ".join((message or "").lower().split())
    selected_subject = _subject_for(text, subject)
    task = next(
        (name for name, terms in _TASK_RULES if any(term in text if " " in term else _contains(text, term) for term in terms)),
        "explain",
    )
    selected_topic = normalize_topic(topic or message) or "general"
    visual_strategy = _visual_for(selected_subject, text)
    variables: tuple[str, ...]
    if visual_strategy == VisualStrategy.MATH_GRAPH:
        variables = ("equation", "inputs", "intermediate_steps", "result")
    elif visual_strategy == VisualStrategy.CODE_TRACE:
        variables = ("source", "state_changes", "execution_steps", "verified_output")
    elif visual_strategy == VisualStrategy.SIMULATION:
        variables = ("initial_conditions", "parameters", "observations", "units")
    else:
        variables = ("components", "relationships", "examples")

    validation = ["keep the explanation grounded in the current question"]
    if visual_strategy == VisualStrategy.MATH_GRAPH:
        validation.extend(("verify arithmetic or symbolic steps when possible", "preserve signs and units"))
    if visual_strategy == VisualStrategy.CODE_TRACE:
        validation.extend(("label output as verified only after execution", "never execute generated code in the renderer"))
    if visual_strategy == VisualStrategy.SIMULATION:
        validation.extend(("label assumptions and approximations", "show units for physical quantities"))
    return LearningClassification(selected_subject, selected_topic, task, visual_strategy, variables, tuple(validation))


def _status(score: float | None, attempts: int) -> MasteryStatus:
    if score is None or attempts <= 0:
        return MasteryStatus.NOT_ASSESSED
    if score < 45:
        return MasteryStatus.NEEDS_REVISION
    if score < 70:
        return MasteryStatus.LEARNING
    if score < 85:
        return MasteryStatus.DEVELOPING
    return MasteryStatus.DEMONSTRATED_MASTERY


def update_topic_mastery(
    previous: Mapping[str, Any] | None,
    *,
    score: float | None,
    hints_used: int = 0,
    evidence_type: str = "assessment",
    explicit_correction: bool = False,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Update one topic estimate while retaining compact, inspectable evidence."""

    old = dict(previous or {})
    old_score = old.get("score")
    old_attempts = int(old.get("attempts") or 0)
    safe_hints = max(0, min(int(hints_used or 0), 20))
    safe_score = None if score is None else max(0.0, min(float(score), 100.0))

    if safe_score is None:
        new_score = float(old_score) if isinstance(old_score, (int, float)) else None
        attempts = old_attempts
    elif isinstance(old_score, (int, float)) and old_attempts > 0:
        # A new result matters, but one mistake cannot erase prior evidence.
        evidence_weight = 0.35 if safe_hints else 0.45
        new_score = round(float(old_score) * (1 - evidence_weight) + safe_score * evidence_weight, 2)
        attempts = old_attempts + 1
    else:
        new_score = round(safe_score, 2)
        attempts = 1

    evidence = list(old.get("evidence") or [])[-5:]
    if safe_score is not None:
        timestamp = (now or datetime.now(timezone.utc)).isoformat()
        evidence.append({
            "score": round(safe_score, 2),
            "hints_used": safe_hints,
            "type": str(evidence_type or "assessment")[:40],
            "explicit_correction": bool(explicit_correction),
            "recorded_at": timestamp,
        })
    confidence = round(min(0.95, 0.2 + attempts * 0.12 + (0.12 if len(evidence) >= 2 else 0)), 2)
    return {
        "score": new_score,
        "attempts": attempts,
        "confidence": confidence if new_score is not None else 0.0,
        "status": _status(new_score, attempts).value,
        "evidence": evidence,
        "updated_at": (now or datetime.now(timezone.utc)).isoformat(),
    }


def parse_mastery_value(value: str | None) -> dict[str, Any] | None:
    """Read current JSON records and tolerate the older text memory format."""

    if not value:
        return None
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict) and ("score" in parsed or "status" in parsed):
            return parsed
    except (TypeError, ValueError):
        pass
    score_match = re.search(r"score=([0-9]+(?:\.[0-9]+)?)", value)
    if score_match:
        score = float(score_match.group(1))
        return update_topic_mastery({}, score=score, evidence_type="legacy")
    return None


def build_adaptive_teaching_context(
    topic: str,
    *,
    mastery: Mapping[str, Any] | None = None,
    weak_topics: list[str] | None = None,
    strong_topics: list[str] | None = None,
    overall_accuracy: int | None = None,
) -> str:
    """Build prompt-safe teaching guidance from evidence, not inferred traits."""

    normalized = normalize_topic(topic)
    score = mastery.get("score") if mastery else None
    attempts = int(mastery.get("attempts") or 0) if mastery else 0
    status = str(mastery.get("status") or _status(score, attempts).value) if mastery else MasteryStatus.NOT_ASSESSED.value
    if score is None:
        level = "foundational and diagnostic"
        evidence = "There is insufficient topic-specific evidence; ask at most one short diagnostic question or teach a clear baseline."
    elif score < 45:
        level = "supported and prerequisite-first"
        evidence = "Use small steps, one worked example, and a low-stakes check before increasing difficulty."
    elif score < 70:
        level = "guided practice"
        evidence = "Use a concise recap followed by a worked example and targeted practice."
    elif score < 85:
        level = "independent application"
        evidence = "Use a normal explanation and an application question; avoid repeating the full lesson."
    else:
        level = "extension and challenge"
        evidence = "Keep fundamentals compact and offer a harder application or transfer question."
    weak = ", ".join((weak_topics or [])[:3]) or "none recorded"
    strong = ", ".join((strong_topics or [])[:3]) or "none recorded"
    accuracy = "unknown" if overall_accuracy is None else str(max(0, min(100, int(overall_accuracy))))
    return (
        "Adaptive learning context (explainable evidence only):\n"
        f"- Current topic: {normalized or 'unspecified'}\n"
        f"- Topic status: {status}; score={score if score is not None else 'not assessed'}; attempts={attempts}\n"
        f"- Recommended teaching level: {level}\n"
        f"- Evidence guidance: {evidence}\n"
        f"- Recorded weak topics: {weak}\n"
        f"- Recorded strong topics: {strong}\n"
        f"- Overall classroom accuracy: {accuracy}\n"
        "Do not infer intelligence, age, disability, personality, or emotion from this data."
    )


def validate_visualization_spec(spec: Mapping[str, Any]) -> dict[str, Any]:
    """Validate and bound a declarative visualization before it reaches a renderer."""

    allowed_modes = {item.value for item in VisualStrategy}
    mode = str(spec.get("mode") or "diagram")
    if mode not in allowed_modes:
        raise ValueError("Unsupported visualization mode")
    title = str(spec.get("title") or "Visual explanation")[:240]
    description = str(spec.get("description") or "")[:1000]
    elements = spec.get("elements") or []
    steps = spec.get("animation_steps") or []
    if not isinstance(elements, list) or not isinstance(steps, list):
        raise ValueError("Visualization elements and animation steps must be lists")
    if len(elements) > 64 or len(steps) > 24:
        raise ValueError("Visualization is too large")
    safe_steps: list[dict[str, Any]] = []
    for step in steps:
        if not isinstance(step, Mapping):
            raise ValueError("Invalid animation step")
        safe_step = dict(step)
        duration = safe_step.get("duration_ms", 1000)
        if not isinstance(duration, (int, float)) or not 100 <= duration <= 30_000:
            raise ValueError("Invalid animation duration")
        safe_step["duration_ms"] = int(duration)
        safe_steps.append(safe_step)
    return {
        **dict(spec),
        "mode": mode,
        "title": title,
        "description": description,
        "elements": [dict(item) for item in elements if isinstance(item, Mapping)],
        "animation_steps": safe_steps,
    }


__all__ = [
    "LearningClassification",
    "MasteryStatus",
    "VisualStrategy",
    "build_adaptive_teaching_context",
    "classify_learning_request",
    "normalize_topic",
    "parse_mastery_value",
    "update_topic_mastery",
    "validate_visualization_spec",
]
