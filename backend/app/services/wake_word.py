"""Explicit, privacy-safe parsing for the optional Smart wake phrase.

This module only parses text that has already been captured by an explicitly
started recognizer. It never opens a microphone or performs background audio
processing.
"""

from __future__ import annotations

import re


SMART_WAKE_RE = re.compile(
    r"^\s*(?:smart|smarter|hey\s+smart|ok\s+smart)"
    r"(?:(?:\s*[,:-]\s*|\s+)(?P<command>.*?))?\s*$",
    re.IGNORECASE,
)


def detect_wake_word(text: str) -> bool:
    """Return whether *text* begins with an intentional Smart wake phrase."""

    return bool(SMART_WAKE_RE.match(text or ""))


def extract_wake_command(text: str) -> str | None:
    """Return the request after Smart, or ``None`` when no request is ready."""

    match = SMART_WAKE_RE.match(text or "")
    if not match:
        return None
    command = (match.group("command") or "").strip()
    return command or None


def strip_wake_word(text: str) -> str:
    """Remove an optional Smart prefix while preserving ordinary input."""

    match = SMART_WAKE_RE.match(text or "")
    if not match:
        return (text or "").strip()
    return (match.group("command") or "").strip()


__all__ = ["SMART_WAKE_RE", "detect_wake_word", "extract_wake_command", "strip_wake_word"]
