"""Pydantic schemas for assessment, labs, projects, and career-readiness APIs."""

from typing import Literal

from pydantic import BaseModel, Field


AssessmentActivityLiteral = Literal[
    "adaptive_quiz",
    "exam_simulation",
    "homework",
    "project_lab",
    "coding_lab",
    "virtual_lab",
    "career_prep",
    "skill_assessment",
]

DifficultyLiteral = Literal["foundational", "easy", "medium", "hard", "expert"]


class AssessmentPlanRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=160)
    subject: str = Field(default="general", min_length=1, max_length=100)
    activity_type: AssessmentActivityLiteral = "adaptive_quiz"
    learner_level: str = Field(default="Adaptive", max_length=80)
    recent_accuracy: int | None = Field(default=None, ge=0, le=100)
    completed_items: int = Field(default=0, ge=0, le=10000)
    exam_name: str | None = Field(default=None, max_length=80)
    requested_difficulty: DifficultyLiteral | Literal["adaptive"] = "adaptive"
    coding_language: str = Field(default="python", min_length=1, max_length=32)
    duration_minutes: int | None = Field(default=None, ge=5, le=300)


class ProjectBriefResponse(BaseModel):
    objective: str
    deliverables: list[str] = Field(default_factory=list)
    evaluation_criteria: list[str] = Field(default_factory=list)
    portfolio_tip: str


class CodingLabBriefResponse(BaseModel):
    language: str
    starter_tasks: list[str] = Field(default_factory=list)
    review_focus: list[str] = Field(default_factory=list)
    safety_checks: list[str] = Field(default_factory=list)


class VirtualLabBriefResponse(BaseModel):
    lab_type: str
    simulation_focus: list[str] = Field(default_factory=list)
    safety_rules: list[str] = Field(default_factory=list)
    observation_tasks: list[str] = Field(default_factory=list)


class AssessmentPlanResponse(BaseModel):
    topic: str
    subject: str
    activity_type: AssessmentActivityLiteral
    mastery_band: Literal["needs_support", "practicing", "proficient", "advanced"]
    difficulty: DifficultyLiteral
    question_types: list[str] = Field(default_factory=list)
    sections: list[str] = Field(default_factory=list)
    duration_minutes: int
    negative_marking: bool
    practice_mix: list[str] = Field(default_factory=list)
    project_brief: ProjectBriefResponse | None = None
    coding_lab: CodingLabBriefResponse | None = None
    virtual_lab: VirtualLabBriefResponse | None = None
    career_actions: list[str] = Field(default_factory=list)
    analytics_signals: list[str] = Field(default_factory=list)
    accessibility_support: list[str] = Field(default_factory=list)
    security_notes: list[str] = Field(default_factory=list)
    evaluation_rubric: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    xp_reward: int = Field(ge=0)


__all__ = [
    "AssessmentActivityLiteral",
    "AssessmentPlanRequest",
    "AssessmentPlanResponse",
    "CodingLabBriefResponse",
    "DifficultyLiteral",
    "ProjectBriefResponse",
    "VirtualLabBriefResponse",
]
