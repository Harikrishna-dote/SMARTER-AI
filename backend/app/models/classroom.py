"""Database models for the AI Tutor Classroom experience."""
from datetime import date

from sqlalchemy import JSON, Boolean, Column, Date, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, new_id


class ClassroomSession(Base, TimestampMixin):
    """A single classroom session: config, topic and the backing chat conversation."""

    __tablename__ = "classroom_sessions"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), index=True, nullable=False)
    title = Column(String(180), nullable=False, default="New classroom")
    topic = Column(String(180), nullable=False, default="General")
    conversation_id = Column(String(36), index=True, nullable=True)
    config = Column(JSON, default=dict)
    current_stage = Column(Integer, default=0, nullable=False)
    lesson_data = Column(JSON, default=dict)
    completed = Column(Boolean, default=False, nullable=False)


class LearningClass(Base, TimestampMixin):
    """A prepared, user-owned learning class.

    ``prepared_content`` is deliberately declarative JSON: it contains the
    curriculum, board scenes, narration cues and practice scaffolds that the
    trusted frontend renderers can consume. It is never executed as code.
    """

    __tablename__ = "learning_classes"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), index=True, nullable=False)
    title = Column(String(180), nullable=False)
    goal = Column(String(500), nullable=False)
    subject = Column(String(160), nullable=False, default="General")
    level = Column(String(80), nullable=False, default="Adaptive")
    language = Column(String(24), nullable=False, default="en")
    status = Column(String(32), nullable=False, default="preparing")
    syllabus_source = Column(String(32), nullable=False, default="smart")
    syllabus_filename = Column(String(255), nullable=True)
    syllabus_text = Column(Text, nullable=False, default="")
    syllabus_topics = Column(JSON, nullable=False, default=list)
    curriculum = Column(JSON, nullable=False, default=list)
    comparison = Column(JSON, nullable=False, default=dict)
    prepared_content = Column(JSON, nullable=False, default=dict)
    preparation = Column(JSON, nullable=False, default=list)
    checkpoint = Column(JSON, nullable=False, default=dict)
    content_hash = Column(String(64), nullable=False, default="")
    current_lesson = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)


class ClassroomProgress(Base, TimestampMixin):
    """Persistent gamified learning progress for a student."""

    __tablename__ = "classroom_progress"

    id = Column(String(36), primary_key=True, default=new_id)
    user_id = Column(String(36), unique=True, index=True, nullable=False)
    xp = Column(Integer, default=0, nullable=False)
    level = Column(Integer, default=1, nullable=False)
    streak = Column(Integer, default=0, nullable=False)
    last_active_date = Column(Date, nullable=True)
    quizzes_taken = Column(Integer, default=0, nullable=False)
    homework_completed = Column(Integer, default=0, nullable=False)
    accuracy = Column(Integer, default=0, nullable=False)
    topics_completed: Mapped[list[str]] = mapped_column(JSON, default=list)
    weak_topics: Mapped[list[str]] = mapped_column(JSON, default=list)
    strong_topics: Mapped[list[str]] = mapped_column(JSON, default=list)
    badges: Mapped[list[str]] = mapped_column(JSON, default=list)
    achievements: Mapped[list[str]] = mapped_column(JSON, default=list)


class ClassroomAnimation(Base, TimestampMixin):
    """Cached animations/visual scripts generated for a specific topic."""

    __tablename__ = "classroom_animations"

    id = Column(String(36), primary_key=True, default=new_id)
    topic = Column(String(180), unique=True, index=True, nullable=False)
    visual_script = Column(JSON, default=list, nullable=False)


__all__ = [
    "ClassroomSession",
    "LearningClass",
    "ClassroomProgress",
    "ClassroomAnimation",
]
