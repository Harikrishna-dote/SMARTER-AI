"""Student profile and adaptive learning domain models."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class KnowledgeLevel(StrEnum):
    NOVICE = "novice"
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class LearningStyle(StrEnum):
    VISUAL = "visual"
    AUDITORY = "auditory"
    KINESTHETIC = "kinesthetic"
    READING = "reading"
    MIXED = "mixed"


class AttentionLevel(StrEnum):
    FULL = "full"
    MODERATE = "moderate"
    LOW = "low"
    DISTRACTED = "distracted"


class EmotionSignal(StrEnum):
    CONFIDENT = "confident"
    CONFUSED = "confused"
    FRUSTRATED = "frustrated"
    BORED = "bored"
    CURIOUS = "curious"
    EXCITED = "excited"
    TIRED = "tired"
    NEUTRAL = "neutral"


@dataclass
class StudentProfile:
    """Persistent student profile for adaptive learning."""
    user_id: str
    knowledge_level: KnowledgeLevel = KnowledgeLevel.NOVICE
    learning_style: LearningStyle = LearningStyle.MIXED
    preferred_language: str = "en"
    preferred_voice: str = "auto"
    preferred_explanation_style: str = "balanced"
    weak_topics: list[str] = field(default_factory=list)
    strong_topics: list[str] = field(default_factory=list)
    completed_lessons: list[str] = field(default_factory=list)
    homework_history: list[str] = field(default_factory=list)
    quiz_history: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    career_goals: list[str] = field(default_factory=list)
    learning_speed: str = "normal"
    attention_level: AttentionLevel = AttentionLevel.FULL
    current_emotion: EmotionSignal = EmotionSignal.NEUTRAL
    confidence_scores: dict[str, float] = field(default_factory=dict)
    mastery_scores: dict[str, float] = field(default_factory=dict)
    interaction_count: int = 0
    total_time_minutes: int = 0
    streak_days: int = 0
    last_active_date: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "knowledge_level": self.knowledge_level.value,
            "learning_style": self.learning_style.value,
            "preferred_language": self.preferred_language,
            "preferred_voice": self.preferred_voice,
            "preferred_explanation_style": self.preferred_explanation_style,
            "weak_topics": self.weak_topics,
            "strong_topics": self.strong_topics,
            "completed_lessons": self.completed_lessons,
            "homework_history": self.homework_history,
            "quiz_history": self.quiz_history,
            "notes": self.notes,
            "career_goals": self.career_goals,
            "learning_speed": self.learning_speed,
            "attention_level": self.attention_level.value,
            "current_emotion": self.current_emotion.value,
            "confidence_scores": self.confidence_scores,
            "mastery_scores": self.mastery_scores,
            "interaction_count": self.interaction_count,
            "total_time_minutes": self.total_time_minutes,
            "streak_days": self.streak_days,
            "last_active_date": self.last_active_date,
        }


@dataclass
class LessonState:
    """Tracks the current state of an autonomous lesson."""
    session_id: str
    user_id: str
    topic: str
    subject: str
    level: str
    language: str
    learning_mode: str
    current_stage: str = "greeting"
    current_step: int = 0
    total_steps: int = 0
    progress_percent: float = 0.0
    is_paused: bool = False
    is_completed: bool = False
    interrupted: bool = False
    interruption_type: str | None = None
    last_taught_concept: str | None = None
    concepts_covered: list[str] = field(default_factory=list)
    pending_concepts: list[str] = field(default_factory=list)
    context_summary: str = ""
    weak_spots: list[str] = field(default_factory=list)
    next_recommendation: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "topic": self.topic,
            "subject": self.subject,
            "level": self.level,
            "language": self.language,
            "learning_mode": self.learning_mode,
            "current_stage": self.current_stage,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "progress_percent": self.progress_percent,
            "is_paused": self.is_paused,
            "is_completed": self.is_completed,
            "interrupted": self.interrupted,
            "interruption_type": self.interruption_type,
            "last_taught_concept": self.last_taught_concept,
            "concepts_covered": self.concepts_covered,
            "pending_concepts": self.pending_concepts,
            "context_summary": self.context_summary,
            "weak_spots": self.weak_spots,
            "next_recommendation": self.next_recommendation,
            "metadata": self.metadata,
        }
