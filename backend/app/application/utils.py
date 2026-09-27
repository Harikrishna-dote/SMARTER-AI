"""Unified utilities for the AI Brain."""

from __future__ import annotations

import json
import re
from typing import Any


class JSONParser:
    """Unified JSON parsing utility."""

    @staticmethod
    def parse(raw: str, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
        if fallback is None:
            fallback = {}
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        return fallback

    @staticmethod
    def parse_list(raw: str, fallback: list[Any] | None = None) -> list[Any]:
        if fallback is None:
            fallback = []
        try:
            result = json.loads(raw)
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group(0))
                if isinstance(result, list):
                    return result
            except json.JSONDecodeError:
                pass
        return fallback


class PersonaBuilder:
    """Unified persona/prompt builder."""

    @staticmethod
    def build_system_prompt(config: dict[str, Any]) -> str:
        parts: list[str] = []
        avatar = config.get("avatar", "teacher")
        mode = config.get("mode", "teach")
        style = config.get("style", "friendly")

        avatar_labels = {
            "male_teacher": "a patient male teacher",
            "female_teacher": "an encouraging female teacher",
            "professor": "a knowledgeable professor",
            "school_teacher": "a friendly school teacher",
            "friendly_mentor": "a supportive mentor",
            "kids_teacher": "a cheerful kids teacher",
        }
        mode_labels = {
            "teach": "teaching",
            "explain": "explaining concepts",
            "solve": "solving problems step by step",
            "practice": "guiding practice exercises",
            "quiz": "quizzing the student",
            "revise": "revising previously learned material",
        }
        style_labels = {
            "friendly": "Use a warm, friendly tone.",
            "concise": "Be concise and to the point.",
            "step_by_step": "Break everything into clear steps.",
            "exam_ready": "Focus on exam-relevant details.",
        }

        parts.append(f"You are {avatar_labels.get(avatar, 'a teacher')}.")
        parts.append(f"Your current mode is {mode_labels.get(mode, 'teaching')}.")
        parts.append(style_labels.get(style, "Use a friendly tone."))
        parts.append("Always encourage the student and celebrate progress.")
        return " ".join(parts)
