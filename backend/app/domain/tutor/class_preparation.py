"""Deterministic preparation primitives for the continuous classroom.

These helpers intentionally do not call an AI provider. They normalize source
material, compare topics, and compile trusted declarative board scenes. Provider
generated lesson content can be inserted into the same pipeline without making
the renderer execute generated code.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any


_HEADING_RE = re.compile(r"^\s*(unit|chapter|module|lesson|topic|section)\s*\d*\s*[:.\-]?\s*(.+)$", re.I)
_BULLET_RE = re.compile(r"^\s*(?:[-*•▪]|\d+[.)])\s+(.+)$")
_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "by", "for", "from", "in", "into",
    "of", "on", "or", "the", "to", "with", "unit", "chapter", "lesson", "topic",
}


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip(" \t:;.-")


def _tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[\w+#.-]+", value.lower(), flags=re.UNICODE)
        if token not in _STOP_WORDS and len(token) > 1
    }


def extract_syllabus_topics(text: str) -> list[str]:
    """Extract only topics explicitly present in uploaded syllabus text.

    The parser prefers headings and list items. For plain text it accepts
    short non-empty lines, while ignoring metadata-like lines such as dates or
    page numbers. It never invents a topic when the source has no usable text.
    """

    topics: list[str] = []
    for raw_line in text.splitlines():
        line = _clean(raw_line)
        if not line or len(line) > 180:
            continue
        heading = _HEADING_RE.match(line)
        bullet = _BULLET_RE.match(line)
        candidate = heading.group(2) if heading else bullet.group(1) if bullet else line
        candidate = _clean(candidate)
        if not candidate or len(candidate) < 2:
            continue
        if re.fullmatch(r"(?:page\s*)?\d+(?:\s+of\s+\d+)?", candidate, flags=re.I):
            continue
        if candidate.lower() in {item.lower() for item in topics}:
            continue
        # Plain paragraphs are not reliable topic boundaries. Accept them only
        # when they look like a heading or a compact syllabus item.
        if not (heading or bullet) and (len(candidate.split()) > 12 or candidate.endswith((".", ":"))):
            continue
        topics.append(candidate)
    return topics[:100]


def _similarity(left: str, right: str) -> float:
    left_tokens = _tokens(left)
    right_tokens = _tokens(right)
    if not left_tokens or not right_tokens:
        return SequenceMatcher(None, left.lower(), right.lower()).ratio()
    overlap = len(left_tokens & right_tokens) / max(1, len(left_tokens | right_tokens))
    sequence = SequenceMatcher(None, left.lower(), right.lower()).ratio()
    return max(overlap, sequence)


def _real_world_example(topic: str, content: str) -> str:
    text = f"{topic} {content}".lower()
    if re.search(r"force|motion|velocity|acceleration|gravity", text):
        return "Real-world check: push a school bag gently and then harder; compare how the change in force affects its motion."
    if re.search(r"code|python|program|algorithm|loop|function", text):
        return "Real-world check: follow the same steps as a recipe—input, repeat the rule, and inspect the result after each step."
    if re.search(r"cell|plant|biology|photosynthesis|organism", text):
        return "Real-world check: observe a plant, then connect the visible change to the process being taught."
    if re.search(r"equation|formula|math|number|algebra|graph", text):
        return "Real-world check: choose one measurable quantity around you and substitute it into the idea before checking the result."
    return f"Real-world check: find one example of {topic} around you and explain which part of the idea it demonstrates."


def _animation_for(topic: str, content: str) -> dict[str, Any]:
    text = f"{topic} {content}".lower()
    if re.search(r"code|python|program|algorithm|loop|function", text):
        kind = "trace"
        labels = ["Input", "Process", "Output"]
    elif re.search(r"equation|formula|math|number|algebra|graph", text):
        kind = "equation"
        labels = ["Given", "Substitute", "Check"]
    elif re.search(r"force|motion|velocity|acceleration|gravity", text):
        kind = "motion"
        labels = ["Cause", "Change", "Result"]
    else:
        kind = "concept_flow"
        labels = ["Idea", "Example", "Practice"]
    return {"kind": kind, "labels": labels, "duration_ms": 1800}


def _interactions_for(animation: dict[str, Any]) -> list[dict[str, Any]]:
    """Describe safe renderer controls without executing model-generated code."""

    kind = animation.get("kind")
    if kind == "motion":
        return [
            {"type": "range", "id": "force", "label": "Force", "min": 1, "max": 60, "unit": "N"},
            {"type": "range", "id": "mass", "label": "Mass", "min": 1, "max": 20, "unit": "kg"},
        ]
    if kind == "equation":
        return [{"type": "range", "id": "input", "label": "Input value", "min": 0, "max": 10, "unit": ""}]
    if kind == "trace":
        return [{"type": "stepper", "id": "execution_step", "label": "Execution step", "min": 0, "max": 3}]
    return [{"type": "stepper", "id": "teaching_step", "label": "Teaching step", "min": 0, "max": max(0, len(animation.get("labels", [])) - 1)}]


def _coverage_fallback_content(topic: str) -> str:
    """Keep an explicit topic in the lesson when a provider omits its outline item."""

    return (
        f"Concept: {topic}.\n"
        "Purpose: define the idea, explain why it matters, and connect it to the lesson goal.\n"
        "Prerequisites: identify the key terms, quantities, units, or rules needed before applying it.\n"
        "Method: name the inputs, apply the rule step by step, and verify the result against the original question.\n"
        "Worked example: choose a simple case, show each step, and explain why the result is reasonable.\n"
        "Real-world example: identify one situation outside the textbook where this concept helps you decide or predict something.\n"
        "Common mistake: do not skip definitions, units, assumptions, or the final verification.\n"
        f"Quick check: explain {topic} in your own words and give one example before continuing."
    )


def _topic_plan(lesson: dict[str, Any], topics: list[str]) -> list[tuple[str, dict[str, Any], str, float]]:
    """Pair every requested curriculum topic with one outline item or a visible fallback."""

    outline = [item for item in (lesson.get("outline") or []) if isinstance(item, dict)]
    requested_topics = [_clean(str(topic)) for topic in topics if _clean(str(topic))]
    if not requested_topics:
        requested_topics = [
            _clean(str(item.get("title") or ""))
            for item in outline
            if _clean(str(item.get("title") or ""))
        ]

    plan: list[tuple[str, dict[str, Any], str, float]] = []
    used_outline: set[int] = set()
    for index, topic in enumerate(requested_topics):
        candidates = sorted(
            (
                (outline_index, _similarity(topic, str(item.get("title") or "")))
                for outline_index, item in enumerate(outline)
                if outline_index not in used_outline and str(item.get("title") or "").strip()
            ),
            key=lambda item: item[1],
            reverse=True,
        )
        best_index, score = candidates[0] if candidates else (-1, 0.0)
        if best_index >= 0 and score >= 0.55:
            used_outline.add(best_index)
            item = dict(outline[best_index])
            item.setdefault("step", index + 1)
            plan.append((topic, item, "model_outline", score))
            continue

        plan.append((
            topic,
            {
                "step": index + 1,
                "title": topic,
                "content": _coverage_fallback_content(topic),
                "minutes": 8,
                "module": "Coverage completion",
                "chapter": topic,
                "subtopics": ["definition and purpose", "step-by-step method", "worked example", "quick check"],
            },
            "coverage_fallback",
            score,
        ))
    return plan


def build_curriculum_tree(lesson: dict[str, Any], topics: list[str]) -> dict[str, Any]:
    """Build a navigable subject -> module -> chapter -> topic plan."""

    modules: list[dict[str, Any]] = []
    module_indexes: dict[str, int] = {}
    for index, (title, item, source, _score) in enumerate(_topic_plan(lesson, topics)):
        module_title = str(item.get("module") or ("Foundations" if index < 3 else "Core concepts" if index < 6 else "Application and mastery"))
        module_index = module_indexes.setdefault(module_title, len(modules))
        if module_index == len(modules):
            modules.append({"id": f"module-{module_index + 1}", "title": module_title, "chapters": []})
        chapter_title = str(item.get("chapter") or title)
        subtopics = [str(value).strip() for value in (item.get("subtopics") or []) if str(value).strip()]
        if not subtopics:
            subtopics = ["meaning and purpose", "how it works", "worked example"]
        modules[module_index]["chapters"].append({
            "id": f"chapter-{index + 1}",
            "title": chapter_title,
            "topics": [{"id": f"topic-{index + 1}", "title": title, "subtopics": subtopics, "coverage_source": source}],
        })

    return {"subject": str(lesson.get("subject") or lesson.get("title") or "General"), "modules": modules}


def compare_curriculum(student_topics: list[str], generated_topics: list[str]) -> dict[str, Any]:
    """Return explainable semantic-ish topic matching and curriculum gaps."""

    matches: list[dict[str, Any]] = []
    used_generated: set[int] = set()
    for student_index, student_topic in enumerate(student_topics):
        candidates = sorted(
            ((index, _similarity(student_topic, generated_topic)) for index, generated_topic in enumerate(generated_topics) if index not in used_generated),
            key=lambda item: item[1],
            reverse=True,
        )
        best_index, score = candidates[0] if candidates else (-1, 0.0)
        generated_topic = generated_topics[best_index] if best_index >= 0 else None
        if score >= 0.72:
            status = "matching"
            used_generated.add(best_index)
        elif score >= 0.42:
            status = "partial_match"
            used_generated.add(best_index)
        else:
            status = "missing_from_ai_plan"
            best_index = -1
            generated_topic = None
        matches.append({
            "student_topic": student_topic,
            "ai_topic": generated_topic,
            "status": status,
            "score": round(score, 3),
            "student_order": student_index,
            "ai_order": best_index if best_index >= 0 else None,
        })

    for ai_index, ai_topic in enumerate(generated_topics):
        if ai_index not in used_generated:
            matches.append({
                "student_topic": None,
                "ai_topic": ai_topic,
                "status": "missing_from_student_syllabus",
                "score": 0.0,
                "student_order": None,
                "ai_order": ai_index,
            })

    order_pairs = [
        (item["student_order"], item["ai_order"])
        for item in matches
        if item["student_order"] is not None and item["ai_order"] is not None
    ]
    different_order = len(order_pairs) > 1 and [pair[1] for pair in order_pairs] != sorted(pair[1] for pair in order_pairs)
    if different_order:
        for item in matches:
            if item["student_order"] is not None and item["ai_order"] is not None and item["status"] == "matching":
                item["status"] = "different_order"

    counts = {key: sum(1 for item in matches if item["status"] == key) for key in (
        "matching", "missing_from_ai_plan", "missing_from_student_syllabus", "partial_match", "different_order",
    )}
    return {
        "matches": matches,
        "counts": counts,
        "different_order": different_order,
        "has_prerequisite_gaps": any("prerequisite" in str(item.get("student_topic", "")).lower() for item in matches),
    }


def merge_topics(student_topics: list[str], generated_topics: list[str], source: str) -> list[str]:
    if source == "student":
        candidates = student_topics
    elif source == "merged":
        candidates = [*student_topics, *generated_topics]
    else:
        candidates = generated_topics
    output: list[str] = []
    for item in candidates:
        topic = _clean(item)
        if topic and not any(_similarity(topic, existing) >= 0.86 for existing in output):
            output.append(topic)
    return output[:100]


def build_board_scene(topic: str, index: int, content: str, language: str) -> dict[str, Any]:
    """Compile a safe board scene understood by trusted frontend renderers."""

    visual_type = "formula" if re.search(r"[=∑∫²³]|formula|equation", content, re.I) else "diagram"
    if re.search(r"code|python|program|function|algorithm", f"{topic} {content}", re.I):
        visual_type = "code_trace"
    animation = _animation_for(topic, content)
    return {
        "id": f"scene-{index + 1}",
        "order": index,
        "topic": topic,
        "visual_type": visual_type,
        "title": topic,
        "body": content,
        "language": language,
        "real_world_example": _real_world_example(topic, content),
        "animation": animation,
        "events": [
            {"type": "highlight", "target": "title", "at": 0},
            {"type": "narrate", "target": "body", "at": 1},
        ],
        "interactions": _interactions_for(animation),
    }


def compile_prepared_content(lesson: dict[str, Any], topics: list[str], language: str) -> dict[str, Any]:
    scenes = []
    coverage_items: list[dict[str, Any]] = []
    fallback_topics: list[str] = []
    for index, (topic, item, source, score) in enumerate(_topic_plan(lesson, topics)):
        content = str(item.get("content") or _coverage_fallback_content(topic))
        scene = build_board_scene(topic, index, content, language)
        scene["coverage_source"] = source
        scene["coverage_score"] = round(score, 3)
        scenes.append(scene)
        if source == "coverage_fallback":
            fallback_topics.append(topic)
        coverage_items.append({
            "topic": topic,
            "scene_id": scene["id"],
            "source": source,
            "score": round(score, 3),
        })
    return {
        "lesson": lesson,
        "curriculum_tree": build_curriculum_tree(lesson, topics),
        "board_scenes": scenes,
        "coverage": {
            "complete": len(coverage_items) == len({_clean(str(topic)) for topic in topics if _clean(str(topic))}) if topics else bool(coverage_items),
            "prepared_topics": [item["topic"] for item in coverage_items],
            "missing_topics": [],
            "fallback_topics": fallback_topics,
            "items": coverage_items,
            "requires_review": bool(fallback_topics),
        },
        "prefetch": {
            "current": scenes[0] if scenes else None,
            "next": scenes[1:3],
            "priority": ["current_content", "next_content", "next_visual", "next_audio"],
        },
        "narration": [{"scene_id": scene["id"], "text": scene["body"], "language": language} for scene in scenes],
        "practice": [{"id": f"practice-{index + 1}", "topic": topic, "prompt": f"Explain one important idea about {topic} in your own words."} for index, topic in enumerate(topics[:8])],
        "notes": {"summary": str(lesson.get("title") or "Prepared lesson"), "key_points": topics[:12], "generated": False},
    }


__all__ = [
    "build_board_scene",
    "build_curriculum_tree",
    "compare_curriculum",
    "compile_prepared_content",
    "extract_syllabus_topics",
    "merge_topics",
]
