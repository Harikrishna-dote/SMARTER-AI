"""Self-review engine for the AI Brain."""

from __future__ import annotations

import re
from typing import Any


class ReviewResult:
    def __init__(self, passed: bool, issues: list[str], suggestions: list[str]) -> None:
        self.passed = passed
        self.issues = issues
        self.suggestions = suggestions

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "issues": self.issues,
            "suggestions": self.suggestions,
        }


class SelfReviewEngine:
    """Reviews AI outputs before returning them to users."""

    async def review(self, response: str, context: dict[str, Any]) -> ReviewResult:
        issues: list[str] = []
        suggestions: list[str] = []

        if self._has_logical_inconsistencies(response):
            issues.append("Potential logical inconsistency detected")
            suggestions.append("Verify factual claims and logical flow")

        if self._has_missing_explanations(response, context):
            issues.append("Response may be missing explanations")
            suggestions.append("Add step-by-step explanations for complex concepts")

        if self._has_incorrect_terminology(response):
            issues.append("Potentially incorrect terminology")
            suggestions.append("Verify subject-specific terminology")

        if self._has_duplicate_content(response):
            issues.append("Duplicate content detected")
            suggestions.append("Remove redundant passages")

        if self._is_incomplete(response, context):
            issues.append("Response may be incomplete")
            suggestions.append("Ensure all parts of the question are addressed")

        passed = len(issues) == 0
        return ReviewResult(passed=passed, issues=issues, suggestions=suggestions)

    def _has_logical_inconsistencies(self, text: str) -> bool:
        sentences = re.split(r"[.!?]", text)
        if len(sentences) < 2:
            return False
        contradictions = 0
        for i in range(len(sentences) - 1):
            if sentences[i].strip().lower() in sentences[i + 1].strip().lower():
                contradictions += 1
        return contradictions > len(sentences) * 0.3

    def _has_missing_explanations(self, text: str, context: dict[str, Any]) -> bool:
        if context.get("mode") == "explain" and len(text) < 100:
            return True
        return False

    def _has_incorrect_terminology(self, text: str) -> bool:
        common_errors = ["their is", "your welcome", "could of", "should of", "would of"]
        lower = text.lower()
        return any(error in lower for error in common_errors)

    def _has_duplicate_content(self, text: str) -> bool:
        words = text.split()
        if len(words) < 20:
            return False
        seen = set()
        for word in words:
            if word in seen:
                return True
            seen.add(word)
        return False

    def _is_incomplete(self, text: str, context: dict[str, Any]) -> bool:
        min_length = context.get("min_length", 50)
        return len(text.strip()) < min_length
