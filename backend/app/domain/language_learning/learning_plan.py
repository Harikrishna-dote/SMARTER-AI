"""Deterministic language-learning policy for translation and OCR selections."""

from dataclasses import dataclass
from enum import StrEnum
import re


class LearningSelectionType(StrEnum):
    WORD = "word"
    SENTENCE = "sentence"
    PARAGRAPH = "paragraph"
    DOCUMENT = "document"


class LanguageSkillFocus(StrEnum):
    VOCABULARY = "vocabulary"
    GRAMMAR = "grammar"
    PRONUNCIATION = "pronunciation"
    READING = "reading"
    WRITING = "writing"
    CONVERSATION = "conversation"


@dataclass(frozen=True)
class PronunciationPlan:
    normal_prompt: str
    slow_prompt: str
    practice_steps: tuple[str, ...]
    common_mistakes: tuple[str, ...]


@dataclass(frozen=True)
class TranslationLearningPlan:
    selection_type: LearningSelectionType
    detected_script: str
    skill_focus: tuple[LanguageSkillFocus, ...]
    teaching_sequence: tuple[str, ...]
    pronunciation: PronunciationPlan
    vocabulary_targets: tuple[str, ...]
    grammar_targets: tuple[str, ...]
    practice_prompts: tuple[str, ...]
    storage_notice: str


_WORD_PATTERN = re.compile(r"^[\w\-'\u0900-\u097F\u0C00-\u0C7F]+$", re.UNICODE)


def detect_selection_type(text: str) -> LearningSelectionType:
    normalized = " ".join(text.strip().split())
    if not normalized:
        return LearningSelectionType.WORD
    word_count = len(normalized.split())
    sentence_marks = sum(normalized.count(mark) for mark in ".!?।॥")
    if word_count == 1 and _WORD_PATTERN.match(normalized):
        return LearningSelectionType.WORD
    if word_count <= 25 and sentence_marks <= 1:
        return LearningSelectionType.SENTENCE
    if word_count <= 180:
        return LearningSelectionType.PARAGRAPH
    return LearningSelectionType.DOCUMENT


def detect_script(text: str) -> str:
    if re.search(r"[\u0C00-\u0C7F]", text):
        return "Telugu"
    if re.search(r"[\u0900-\u097F]", text):
        return "Devanagari"
    if re.search(r"[A-Za-z]", text):
        return "Latin"
    return "Unknown"


def _vocabulary_targets(text: str, selection_type: LearningSelectionType) -> tuple[str, ...]:
    words = [word.strip(".,!?;:\"'()[]{}") for word in text.split()]
    unique: list[str] = []
    for word in words:
        if len(word) < 3 or word.lower() in {item.lower() for item in unique}:
            continue
        unique.append(word)
        if len(unique) == (1 if selection_type == LearningSelectionType.WORD else 8):
            break
    return tuple(unique)


def _grammar_targets(selection_type: LearningSelectionType) -> tuple[str, ...]:
    if selection_type == LearningSelectionType.WORD:
        return ("part of speech", "contextual meaning", "common phrases")
    if selection_type == LearningSelectionType.SENTENCE:
        return ("subject", "verb", "object", "tense", "natural phrasing")
    if selection_type == LearningSelectionType.PARAGRAPH:
        return ("main idea", "tone", "cohesion", "important grammar patterns")
    return ("document structure", "headings", "key terms", "section summaries")


def _skill_focus(selection_type: LearningSelectionType) -> tuple[LanguageSkillFocus, ...]:
    if selection_type == LearningSelectionType.WORD:
        return (LanguageSkillFocus.VOCABULARY, LanguageSkillFocus.PRONUNCIATION)
    if selection_type == LearningSelectionType.SENTENCE:
        return (LanguageSkillFocus.GRAMMAR, LanguageSkillFocus.PRONUNCIATION, LanguageSkillFocus.CONVERSATION)
    if selection_type == LearningSelectionType.PARAGRAPH:
        return (LanguageSkillFocus.READING, LanguageSkillFocus.VOCABULARY, LanguageSkillFocus.WRITING)
    return (LanguageSkillFocus.READING, LanguageSkillFocus.VOCABULARY, LanguageSkillFocus.GRAMMAR)


def build_translation_learning_plan(
    text: str,
    *,
    source_language: str,
    target_language: str,
    selection_type: LearningSelectionType | None = None,
    store_for_review: bool = False,
) -> TranslationLearningPlan:
    resolved_selection = selection_type or detect_selection_type(text)
    pronunciation = PronunciationPlan(
        normal_prompt=f"Read the {target_language} translation naturally.",
        slow_prompt=f"Read the {target_language} translation slowly with syllable clarity.",
        practice_steps=(
            "Listen once without repeating.",
            "Repeat slowly and compare difficult sounds.",
            "Use the word or sentence in a new real-life example.",
        ),
        common_mistakes=(
            "Do not translate idioms word-for-word without checking context.",
            "Do not ignore politeness, tense, or speaker intent.",
        ),
    )
    return TranslationLearningPlan(
        selection_type=resolved_selection,
        detected_script=detect_script(text),
        skill_focus=_skill_focus(resolved_selection),
        teaching_sequence=(
            "Translate meaning first, not isolated words.",
            "Explain important vocabulary and grammar.",
            "Show natural usage and common mistakes.",
            "Practice pronunciation and one student-created example.",
        ),
        pronunciation=pronunciation,
        vocabulary_targets=_vocabulary_targets(text, resolved_selection),
        grammar_targets=_grammar_targets(resolved_selection),
        practice_prompts=(
            f"Say this in {target_language} using a different example.",
            "Identify one grammar pattern from the selection.",
            "Save difficult words to the vocabulary notebook for review.",
        ),
        storage_notice=(
            "Saved to vocabulary/review memory because the user requested it."
            if store_for_review
            else "Not stored for personalization unless the user saves it."
        ),
    )

