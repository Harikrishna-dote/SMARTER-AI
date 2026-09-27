"""Domain policy for autonomous tutor lessons.

This module is intentionally framework-free. API routes, database sessions, and
LLM clients should depend on these contracts instead of embedding lesson policy
inside route handlers or persistence code.
"""

from dataclasses import dataclass, field
from enum import StrEnum


class LessonStage(StrEnum):
    GREETING = "greeting"
    LEARNING_OBJECTIVE = "learning_objective"
    ASSESS_PRIOR_KNOWLEDGE = "assess_prior_knowledge"
    PERSONALIZED_PLAN = "personalized_plan"
    TOPIC_INTRODUCTION = "topic_introduction"
    CONCEPT_EXPLANATION = "concept_explanation"
    VISUAL_DEMONSTRATION = "visual_demonstration"
    REAL_LIFE_EXAMPLE = "real_life_example"
    INTERACTIVE_DISCUSSION = "interactive_discussion"
    GUIDED_PRACTICE = "guided_practice"
    MINI_QUIZ = "mini_quiz"
    MISTAKE_ANALYSIS = "mistake_analysis"
    HOMEWORK = "homework"
    NOTES = "notes"
    SUMMARY = "summary"
    RECOMMENDATION = "recommendation"
    NEXT_LESSON = "next_lesson"


AUTONOMOUS_LESSON_STAGES: tuple[LessonStage, ...] = (
    LessonStage.GREETING,
    LessonStage.LEARNING_OBJECTIVE,
    LessonStage.ASSESS_PRIOR_KNOWLEDGE,
    LessonStage.PERSONALIZED_PLAN,
    LessonStage.TOPIC_INTRODUCTION,
    LessonStage.CONCEPT_EXPLANATION,
    LessonStage.VISUAL_DEMONSTRATION,
    LessonStage.REAL_LIFE_EXAMPLE,
    LessonStage.INTERACTIVE_DISCUSSION,
    LessonStage.GUIDED_PRACTICE,
    LessonStage.MINI_QUIZ,
    LessonStage.MISTAKE_ANALYSIS,
    LessonStage.HOMEWORK,
    LessonStage.NOTES,
    LessonStage.SUMMARY,
    LessonStage.RECOMMENDATION,
    LessonStage.NEXT_LESSON,
)


@dataclass(frozen=True)
class LearningContext:
    user_id: str
    topic: str
    subject: str
    level: str
    language: str
    learning_mode: str
    completed_topics: tuple[str, ...] = ()
    weak_topics: tuple[str, ...] = ()
    strong_topics: tuple[str, ...] = ()


@dataclass(frozen=True)
class TeachingStrategyProfile:
    approach: str
    pacing: str
    explanation_style: str
    interaction_pattern: str
    include_visuals: bool = True
    include_practice: bool = True
    include_assessment: bool = True


@dataclass(frozen=True)
class TutorLessonBlueprint:
    context: LearningContext
    stages: tuple[LessonStage, ...] = AUTONOMOUS_LESSON_STAGES
    strategy: TeachingStrategyProfile = field(
        default_factory=lambda: TeachingStrategyProfile(
            approach="example_driven",
            pacing="normal",
            explanation_style="definition_then_example",
            interaction_pattern="teach_check_continue",
        )
    )
    missing_prerequisites: tuple[str, ...] = ()

    @property
    def ready_for_target_topic(self) -> bool:
        return not self.missing_prerequisites


def choose_teaching_strategy(context: LearningContext, teaching_style: str) -> TeachingStrategyProfile:
    style = teaching_style.lower().strip()
    mode = context.learning_mode.lower().strip()
    weak_topics = {topic.lower() for topic in context.weak_topics}

    if context.topic.lower() in weak_topics or style == "slow":
        return TeachingStrategyProfile(
            approach="analogy_driven",
            pacing="slow",
            explanation_style="small_chunks_with_repetition",
            interaction_pattern="teach_check_clarify",
        )
    if style in {"visual", "story_based", "exam_oriented", "concept_based"}:
        approach_by_style = {
            "visual": "visual_learning",
            "story_based": "story_based",
            "exam_oriented": "exam_preparation",
            "concept_based": "feynman",
        }
        return TeachingStrategyProfile(
            approach=approach_by_style[style],
            pacing="normal",
            explanation_style=style,
            interaction_pattern="teach_predict_practice",
        )
    if mode in {"programming", "interview"}:
        return TeachingStrategyProfile(
            approach="problem_solving",
            pacing="normal",
            explanation_style="step_execution",
            interaction_pattern="explain_trace_challenge",
        )
    if mode == "research":
        return TeachingStrategyProfile(
            approach="socratic",
            pacing="normal",
            explanation_style="evidence_first",
            interaction_pattern="question_reason_reflect",
        )
    return TeachingStrategyProfile(
        approach="example_driven",
        pacing="fast" if style == "fast" else "normal",
        explanation_style="definition_then_example",
        interaction_pattern="teach_check_continue",
    )

