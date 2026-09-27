"""Pydantic schemas for the AI Tutor Classroom feature."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

AvatarType = Literal[
    "male_teacher",
    "female_teacher",
    "professor",
    "school_teacher",
    "friendly_mentor",
    "kids_teacher",
]
LearningMode = Literal[
    "school",
    "college",
    "competitive_exam",
    "programming",
    "interview",
    "language_learning",
    "research",
    "professional_certification",
]
TeachingStyle = Literal[
    "slow",
    "normal",
    "fast",
    "very_detailed",
    "quick_revision",
    "visual",
    "story_based",
    "practical",
    "exam_oriented",
    "concept_based",
    "custom",
]
LanguageCode = Literal["en", "te", "hi", "bilingual"]


class CurriculumContext(BaseModel):
    """User-provided curriculum identity; blank fields mean not specified."""

    country: str | None = Field(default=None, max_length=80)
    board: str | None = Field(default=None, max_length=120)
    institution: str | None = Field(default=None, max_length=160)
    course: str | None = Field(default=None, max_length=160)
    class_name: str | None = Field(default=None, max_length=80)
    academic_year: str | None = Field(default=None, max_length=40)
    exam: str | None = Field(default=None, max_length=120)


class ClassroomConfig(BaseModel):
    avatar_type: AvatarType = "friendly_mentor"
    learning_mode: LearningMode = "school"
    teaching_style: TeachingStyle = "normal"
    custom_style_description: str | None = Field(default=None, max_length=200)
    language: LanguageCode = "en"
    topic: str = Field(default="General", min_length=1, max_length=120)
    level: str = Field(default="Adaptive", max_length=80)
    curriculum_context: CurriculumContext = Field(default_factory=CurriculumContext)


class AvatarControlRequest(BaseModel):
    expression: str | None = None
    gesture: str | None = None
    language: LanguageCode | None = None
    speaking: bool | None = None
    lip_sync: bool | None = None
    eye_target: str | None = None
    quality: str | None = None
    fullscreen: bool | None = None
    captions_enabled: bool | None = None


class GenerateLessonRequest(BaseModel):
    config: ClassroomConfig
    topic: str = Field(min_length=1, max_length=120)


class AutonomousSessionRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=80)


class ContinueAutonomousLessonRequest(AutonomousSessionRequest):
    student_input: str | None = Field(default=None, max_length=4000)


class ChangeAutonomousTopicRequest(AutonomousSessionRequest):
    new_topic: str = Field(min_length=1, max_length=120)
    config: ClassroomConfig


class LessonOutlineItem(BaseModel):
    step: int
    title: str
    content: str
    minutes: int = 5
    visual_script: list[dict[str, Any]] = Field(default_factory=list)
    module: str = "Core concepts"
    chapter: str | None = None
    subtopics: list[str] = Field(default_factory=list)


class GeneratedLesson(BaseModel):
    title: str
    subject: str
    difficulty: str
    estimated_minutes: int
    learning_objectives: list[str] = Field(default_factory=list)
    outline: list[LessonOutlineItem] = Field(default_factory=list)
    key_concepts: list[str] = Field(default_factory=list)
    completed_topics: list[str] = Field(default_factory=list)
    remaining_topics: list[str] = Field(default_factory=list)


ClassSource = Literal["smart", "student", "merged", "custom"]


class CreateLearningClassRequest(BaseModel):
    goal: str = Field(min_length=2, max_length=500)
    level: str = Field(default="Adaptive", min_length=1, max_length=80)
    language: LanguageCode = "en"
    syllabus_source: ClassSource = "smart"
    syllabus_text: str = Field(default="", max_length=200_000)
    syllabus_filename: str | None = Field(default=None, max_length=255)
    avatar_type: AvatarType = "friendly_mentor"
    learning_mode: LearningMode = "school"
    teaching_style: TeachingStyle = "visual"
    curriculum_context: CurriculumContext = Field(default_factory=CurriculumContext)


class SyllabusExtractionRead(BaseModel):
    filename: str
    text: str
    topics: list[str] = Field(default_factory=list)
    character_count: int


class PreparationStageRead(BaseModel):
    id: str
    label: str
    status: Literal["pending", "running", "complete", "failed"]


class CurriculumUpdateRequest(BaseModel):
    topics: list[str] = Field(min_length=1, max_length=100)
    source: ClassSource = "custom"


class CheckpointUpdateRequest(BaseModel):
    current_lesson: int = Field(default=0, ge=0, le=1000)
    scene_id: str | None = Field(default=None, max_length=120)
    stage: str | None = Field(default=None, max_length=120)
    position: float = Field(default=0.0, ge=0.0, le=1_000_000.0)
    paused: bool = False
    current_concept: str | None = Field(default=None, max_length=500)
    current_sentence: str | None = Field(default=None, max_length=20_000)
    visual_state: dict[str, Any] | None = None
    animation_time: float | None = Field(default=None, ge=0.0, le=86_400.0)
    lesson_progress: float | None = Field(default=None, ge=0.0, le=100.0)
    mastery: dict[str, Any] | None = None
    language: LanguageCode | None = None
    voice_settings: dict[str, Any] | None = None
    difficulty: str | None = Field(default=None, max_length=80)
    pending_question: str | None = Field(default=None, max_length=4_000)
    pending_task: dict[str, Any] | None = None


class LearningClassRead(BaseModel):
    id: str
    title: str
    goal: str
    subject: str
    level: str
    language: LanguageCode
    status: str
    syllabus_source: ClassSource
    syllabus_filename: str | None = None
    syllabus_topics: list[str] = Field(default_factory=list)
    curriculum: list[str] = Field(default_factory=list)
    comparison: dict[str, Any] = Field(default_factory=dict)
    prepared_content: dict[str, Any] = Field(default_factory=dict)
    preparation: list[PreparationStageRead] = Field(default_factory=list)
    checkpoint: dict[str, Any] = Field(default_factory=dict)
    content_hash: str
    current_lesson: int
    last_error: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StartLearningClassRead(BaseModel):
    learning_class: LearningClassRead
    session: dict[str, Any]


class GenerateQuizRequest(BaseModel):
    config: ClassroomConfig
    topic: str = Field(min_length=1, max_length=120)
    count: int = Field(default=5, ge=1, le=20)
    types: list[str] = Field(default_factory=lambda: ["mcq", "true_false", "fill_blank"])


class QuizQuestion(BaseModel):
    id: str
    type: str
    question: str
    options: list[str] = Field(default_factory=list)
    answer: str = ""
    explanation: str = ""


class GeneratedQuiz(BaseModel):
    topic: str
    questions: list[QuizQuestion] = Field(default_factory=list)


class GenerateNotesRequest(BaseModel):
    config: ClassroomConfig
    topic: str = Field(min_length=1, max_length=120)


class Flashcard(BaseModel):
    term: str
    definition: str


class GeneratedNotes(BaseModel):
    summary: str = ""
    key_points: list[str] = Field(default_factory=list)
    formula_sheet: list[str] = Field(default_factory=list)
    flashcards: list[Flashcard] = Field(default_factory=list)
    revision_sheet: str = ""
    mindmap: str = ""


class GenerateHomeworkRequest(BaseModel):
    config: ClassroomConfig
    topic: str = Field(min_length=1, max_length=120)
    difficulty: str = "medium"


class HomeworkTask(BaseModel):
    id: str
    question: str
    hint: str = ""


class GeneratedHomework(BaseModel):
    topic: str
    difficulty: str
    tasks: list[HomeworkTask] = Field(default_factory=list)
    note: str = ""


class EvaluateHomeworkItem(BaseModel):
    question: str
    answer: str
    expected: str = ""


class EvaluateHomeworkRequest(BaseModel):
    config: ClassroomConfig
    items: list[EvaluateHomeworkItem] = Field(min_length=1, max_length=50)


class EvaluatedItem(BaseModel):
    question: str
    correct: bool
    score: int
    feedback: str


class HomeworkEvaluation(BaseModel):
    overall_score: int
    items: list[EvaluatedItem] = Field(default_factory=list)


class ProgressUpdate(BaseModel):
    xp_delta: int = Field(default=0, ge=0, le=1000)
    action: str = "practice"
    topic: str | None = None
    quiz_score: int | None = Field(default=None, ge=0, le=100)
    homework_correct: int | None = Field(default=None, ge=0)
    homework_total: int | None = Field(default=None, ge=0)


class Badge(BaseModel):
    id: str
    label: str
    description: str


class ClassroomProgressRead(BaseModel):
    xp: int
    level: int
    xp_for_next_level: int
    xp_into_level: int
    streak: int
    quizzes_taken: int
    homework_completed: int
    accuracy: int
    topics_completed: list[str] = Field(default_factory=list)
    weak_topics: list[str] = Field(default_factory=list)
    strong_topics: list[str] = Field(default_factory=list)
    badges: list[Badge] = Field(default_factory=list)
    achievements: list[str] = Field(default_factory=list)
    last_active_date: str | None = None


VisualType = Literal[
    "animation",
    "diagram",
    "flowchart",
    "simulation",
    "infographic",
    "timeline",
    "mindmap",
    "graph",
    "chart",
    "model_3d",
    "interactive",
    "whiteboard",
]


class VisualAnalysis(BaseModel):
    visual_type: VisualType = "diagram"
    complexity: Literal["low", "medium", "high"] = "medium"
    recommended_animations: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reasoning: str = ""


class PrerequisiteCheck(BaseModel):
    ready: bool = False
    missing: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    readiness_score: float = Field(default=0.0, ge=0.0, le=1.0)


class KnowledgeGraphNode(BaseModel):
    id: str
    label: str
    level: str = "beginner"
    subject: str = "general"
    mastery: float = Field(default=0.0, ge=0.0, le=1.0)
    dependencies: list[str] = Field(default_factory=list)


class KnowledgeGraphEdge(BaseModel):
    source: str
    target: str
    weight: float = Field(default=1.0, ge=0.0)
    relation: str = "prerequisite"


class KnowledgeGraph(BaseModel):
    nodes: list[KnowledgeGraphNode] = Field(default_factory=list)
    edges: list[KnowledgeGraphEdge] = Field(default_factory=list)
    levels: dict[str, list[str]] = Field(default_factory=dict)
    recommended_path: list[str] = Field(default_factory=list)


class TopicAnalysis(BaseModel):
    difficulty: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    prerequisites: list[str] = Field(default_factory=list)
    misconceptions: list[str] = Field(default_factory=list)
    strategies: list[str] = Field(default_factory=list)
    key_concepts: list[str] = Field(default_factory=list)
    estimated_duration_minutes: int = Field(default=30, ge=5, le=180)
    suggested_visual_types: list[VisualType] = Field(default_factory=list)


class TeachingStrategy(BaseModel):
    approach: Literal[
        "visual_first",
        "analogy_based",
        "step_by_step",
        "problem_solving",
        "comparison",
        "story_based",
        "socratic",
        "direct_instruction",
    ] = "visual_first"
    explanation_style: str = "balanced"
    include_practice: bool = True
    include_assessment: bool = True
    pacing: Literal["slow", "normal", "fast"] = "normal"
    reasoning: str = ""


class VisualContentRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=120)
    subject: str = Field(default="general", max_length=80)
    level: str = Field(default="beginner", max_length=80)
    visual_type: VisualType = "diagram"
    config: dict[str, Any] = Field(default_factory=dict)


class VisualContentResponse(BaseModel):
    topic: str
    subject: str
    visual_type: VisualType
    script: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    analysis: VisualAnalysis | None = None


__all__ = [
    "AvatarType",
    "LearningMode",
    "TeachingStyle",
    "LanguageCode",
    "CurriculumContext",
    "ClassroomConfig",
    "ClassSource",
    "CreateLearningClassRequest",
    "SyllabusExtractionRead",
    "PreparationStageRead",
    "CurriculumUpdateRequest",
    "CheckpointUpdateRequest",
    "LearningClassRead",
    "StartLearningClassRead",
    "GenerateLessonRequest",
    "AutonomousSessionRequest",
    "ContinueAutonomousLessonRequest",
    "ChangeAutonomousTopicRequest",
    "LessonOutlineItem",
    "GeneratedLesson",
    "GenerateQuizRequest",
    "QuizQuestion",
    "GeneratedQuiz",
    "GenerateNotesRequest",
    "Flashcard",
    "GeneratedNotes",
    "GenerateHomeworkRequest",
    "HomeworkTask",
    "GeneratedHomework",
    "EvaluateHomeworkItem",
    "EvaluateHomeworkRequest",
    "EvaluatedItem",
    "HomeworkEvaluation",
    "ProgressUpdate",
    "Badge",
    "ClassroomProgressRead",
    "VisualType",
    "VisualAnalysis",
    "PrerequisiteCheck",
    "KnowledgeGraph",
    "KnowledgeGraphNode",
    "KnowledgeGraphEdge",
    "TopicAnalysis",
    "TeachingStrategy",
    "VisualContentRequest",
    "VisualContentResponse",
]
