"""Deterministic assessment, lab, project, career, and analytics policy."""

from dataclasses import dataclass
from enum import StrEnum


class AssessmentActivityType(StrEnum):
    ADAPTIVE_QUIZ = "adaptive_quiz"
    EXAM_SIMULATION = "exam_simulation"
    HOMEWORK = "homework"
    PROJECT_LAB = "project_lab"
    CODING_LAB = "coding_lab"
    VIRTUAL_LAB = "virtual_lab"
    CAREER_PREP = "career_prep"
    SKILL_ASSESSMENT = "skill_assessment"


class DifficultyBand(StrEnum):
    FOUNDATIONAL = "foundational"
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


class MasteryBand(StrEnum):
    NEEDS_SUPPORT = "needs_support"
    PRACTICING = "practicing"
    PROFICIENT = "proficient"
    ADVANCED = "advanced"


@dataclass(frozen=True)
class ProjectBrief:
    objective: str
    deliverables: tuple[str, ...]
    evaluation_criteria: tuple[str, ...]
    portfolio_tip: str


@dataclass(frozen=True)
class CodingLabBrief:
    language: str
    starter_tasks: tuple[str, ...]
    review_focus: tuple[str, ...]
    safety_checks: tuple[str, ...]


@dataclass(frozen=True)
class VirtualLabBrief:
    lab_type: str
    simulation_focus: tuple[str, ...]
    safety_rules: tuple[str, ...]
    observation_tasks: tuple[str, ...]


@dataclass(frozen=True)
class AssessmentPlan:
    topic: str
    subject: str
    activity_type: AssessmentActivityType
    mastery_band: MasteryBand
    difficulty: DifficultyBand
    question_types: tuple[str, ...]
    sections: tuple[str, ...]
    duration_minutes: int
    negative_marking: bool
    practice_mix: tuple[str, ...]
    project_brief: ProjectBrief | None
    coding_lab: CodingLabBrief | None
    virtual_lab: VirtualLabBrief | None
    career_actions: tuple[str, ...]
    analytics_signals: tuple[str, ...]
    accessibility_support: tuple[str, ...]
    security_notes: tuple[str, ...]
    evaluation_rubric: tuple[str, ...]
    next_steps: tuple[str, ...]
    xp_reward: int


_EXAM_DURATION_MINUTES = {
    "ecet": 180,
    "eamcet": 180,
    "jee": 180,
    "neet": 200,
    "gate": 180,
    "upsc": 120,
    "ssc": 60,
    "bank": 60,
    "gre": 118,
    "ielts": 165,
    "toefl": 116,
    "technical placement tests": 90,
    "programming certifications": 120,
}


def estimate_mastery_band(recent_accuracy: int | None, completed_items: int = 0) -> MasteryBand:
    if recent_accuracy is None:
        return MasteryBand.PRACTICING if completed_items else MasteryBand.NEEDS_SUPPORT
    score = max(0, min(100, recent_accuracy))
    if score < 50:
        return MasteryBand.NEEDS_SUPPORT
    if score < 70:
        return MasteryBand.PRACTICING
    if score < 85:
        return MasteryBand.PROFICIENT
    return MasteryBand.ADVANCED


def choose_difficulty(
    mastery_band: MasteryBand,
    requested_difficulty: DifficultyBand | None = None,
) -> DifficultyBand:
    if requested_difficulty:
        return requested_difficulty
    return {
        MasteryBand.NEEDS_SUPPORT: DifficultyBand.EASY,
        MasteryBand.PRACTICING: DifficultyBand.MEDIUM,
        MasteryBand.PROFICIENT: DifficultyBand.HARD,
        MasteryBand.ADVANCED: DifficultyBand.EXPERT,
    }[mastery_band]


def _question_types(activity_type: AssessmentActivityType, difficulty: DifficultyBand, exam_name: str) -> tuple[str, ...]:
    if activity_type == AssessmentActivityType.CODING_LAB:
        return ("coding", "debugging", "code_review", "complexity_analysis")
    if activity_type == AssessmentActivityType.PROJECT_LAB:
        return ("case_study", "implementation_review", "reflection", "presentation")
    if activity_type == AssessmentActivityType.VIRTUAL_LAB:
        return ("prediction", "observation", "calculation", "diagram_labeling")
    if activity_type == AssessmentActivityType.CAREER_PREP:
        return ("technical_interview", "behavioral_interview", "system_design", "communication")
    if activity_type == AssessmentActivityType.EXAM_SIMULATION:
        language_exam = exam_name.lower() in {"ielts", "toefl", "gre"}
        if language_exam:
            return ("mcq", "short_answer", "long_answer", "listening_reading", "writing")
        return ("mcq", "calculation", "logical_reasoning", "case_study")
    if difficulty in {DifficultyBand.HARD, DifficultyBand.EXPERT}:
        return ("mcq", "short_answer", "case_study", "calculation", "logical_reasoning")
    return ("mcq", "true_false", "fill_blank", "short_answer")


def _sections(activity_type: AssessmentActivityType, topic: str, exam_name: str) -> tuple[str, ...]:
    if activity_type == AssessmentActivityType.EXAM_SIMULATION:
        label = exam_name or "Custom Exam"
        return (f"{label} Section A: fundamentals", f"{label} Section B: application", f"{label} Section C: analysis")
    if activity_type == AssessmentActivityType.PROJECT_LAB:
        return ("Plan", "Build", "Test", "Reflect")
    if activity_type == AssessmentActivityType.CODING_LAB:
        return ("Read problem", "Implement", "Debug", "Review")
    if activity_type == AssessmentActivityType.VIRTUAL_LAB:
        return ("Hypothesis", "Simulation", "Observation", "Conclusion")
    if activity_type == AssessmentActivityType.CAREER_PREP:
        return ("Skill gap", "Practice", "Portfolio", "Mock interview")
    return (f"{topic} concept check", f"{topic} application", f"{topic} reflection")


def _practice_mix(mastery_band: MasteryBand) -> tuple[str, ...]:
    if mastery_band == MasteryBand.NEEDS_SUPPORT:
        return ("guided examples", "low-stakes recall", "mistake analysis", "short revision")
    if mastery_band == MasteryBand.PRACTICING:
        return ("mixed practice", "worked examples", "mini quiz", "targeted homework")
    if mastery_band == MasteryBand.PROFICIENT:
        return ("timed practice", "case studies", "challenge questions", "peer-style explanation")
    return ("exam-speed practice", "open-ended problems", "portfolio task", "mentor review")


def _project_brief(activity_type: AssessmentActivityType, topic: str) -> ProjectBrief | None:
    if activity_type != AssessmentActivityType.PROJECT_LAB:
        return None
    return ProjectBrief(
        objective=f"Build a real-world artifact that demonstrates {topic}.",
        deliverables=("problem statement", "implementation", "test evidence", "reflection notes"),
        evaluation_criteria=("correctness", "clarity", "practical value", "iteration quality"),
        portfolio_tip="Publish a concise case study with screenshots, decisions, and measurable outcomes.",
    )


def _coding_lab(activity_type: AssessmentActivityType, topic: str, language: str) -> CodingLabBrief | None:
    if activity_type != AssessmentActivityType.CODING_LAB:
        return None
    return CodingLabBrief(
        language=language,
        starter_tasks=(
            f"Implement the smallest working solution for {topic}.",
            "Add one failing test or example before fixing edge cases.",
            "Refactor for readability after correctness is proven.",
        ),
        review_focus=("correctness", "time complexity", "space complexity", "naming", "security risks"),
        safety_checks=("run code in a sandbox", "limit execution time", "avoid secrets in submissions"),
    )


def _virtual_lab(activity_type: AssessmentActivityType, subject: str, topic: str) -> VirtualLabBrief | None:
    if activity_type != AssessmentActivityType.VIRTUAL_LAB:
        return None
    lab_type = "science_simulation" if subject.lower() in {"physics", "chemistry", "biology", "astronomy"} else "engineering_simulation"
    return VirtualLabBrief(
        lab_type=lab_type,
        simulation_focus=(f"change one variable related to {topic}", "observe the outcome", "compare with prediction"),
        safety_rules=("virtual-only experiment", "show assumptions", "label units and limits"),
        observation_tasks=("record variables", "explain cause and effect", "summarize limitations"),
    )


def _career_actions(activity_type: AssessmentActivityType, topic: str) -> tuple[str, ...]:
    if activity_type == AssessmentActivityType.CAREER_PREP:
        return (
            f"Map {topic} to job roles and interview expectations.",
            "Identify two resume bullets backed by evidence.",
            "Prepare one STAR behavioral answer and one technical explanation.",
        )
    if activity_type in {AssessmentActivityType.PROJECT_LAB, AssessmentActivityType.CODING_LAB}:
        return ("save the project for portfolio review", "document tradeoffs", "prepare a two-minute demo")
    return ("connect the assessment result to the next lesson", "review weak concepts before increasing difficulty")


def _duration(activity_type: AssessmentActivityType, exam_name: str, requested_minutes: int | None) -> int:
    if requested_minutes:
        return max(5, min(300, requested_minutes))
    if activity_type == AssessmentActivityType.EXAM_SIMULATION:
        return _EXAM_DURATION_MINUTES.get(exam_name.lower(), 60)
    return {
        AssessmentActivityType.ADAPTIVE_QUIZ: 15,
        AssessmentActivityType.HOMEWORK: 45,
        AssessmentActivityType.PROJECT_LAB: 120,
        AssessmentActivityType.CODING_LAB: 60,
        AssessmentActivityType.VIRTUAL_LAB: 40,
        AssessmentActivityType.CAREER_PREP: 45,
        AssessmentActivityType.SKILL_ASSESSMENT: 30,
    }[activity_type]


def build_assessment_plan(
    *,
    topic: str,
    subject: str = "general",
    activity_type: AssessmentActivityType = AssessmentActivityType.ADAPTIVE_QUIZ,
    recent_accuracy: int | None = None,
    completed_items: int = 0,
    exam_name: str = "",
    requested_difficulty: DifficultyBand | None = None,
    coding_language: str = "python",
    duration_minutes: int | None = None,
) -> AssessmentPlan:
    mastery_band = estimate_mastery_band(recent_accuracy, completed_items)
    difficulty = choose_difficulty(mastery_band, requested_difficulty)
    normalized_exam = exam_name.strip()
    negative_marking = activity_type == AssessmentActivityType.EXAM_SIMULATION and normalized_exam.lower() not in {
        "",
        "ielts",
        "toefl",
    }
    return AssessmentPlan(
        topic=topic,
        subject=subject,
        activity_type=activity_type,
        mastery_band=mastery_band,
        difficulty=difficulty,
        question_types=_question_types(activity_type, difficulty, normalized_exam),
        sections=_sections(activity_type, topic, normalized_exam),
        duration_minutes=_duration(activity_type, normalized_exam, duration_minutes),
        negative_marking=negative_marking,
        practice_mix=_practice_mix(mastery_band),
        project_brief=_project_brief(activity_type, topic),
        coding_lab=_coding_lab(activity_type, topic, coding_language),
        virtual_lab=_virtual_lab(activity_type, subject, topic),
        career_actions=_career_actions(activity_type, topic),
        analytics_signals=(
            "accuracy_by_question_type",
            "time_per_section",
            "mistake_patterns",
            "revision_frequency",
            "project_completion_quality",
        ),
        accessibility_support=(
            "keyboard_navigation",
            "screen_reader_labels",
            "captions_or_text_alternatives",
            "adjustable_font_and_contrast",
        ),
        security_notes=(
            "authorize every submission by user",
            "sandbox code execution",
            "audit exam attempts",
            "avoid storing secrets in project files",
        ),
        evaluation_rubric=(
            "knowledge accuracy",
            "reasoning quality",
            "problem-solving process",
            "communication clarity",
            "practical application",
        ),
        next_steps=(
            "review incorrect or weak concepts",
            "generate targeted practice",
            "record mastery in learning memory",
            "recommend the next lesson or project",
        ),
        xp_reward=20 + (10 * list(DifficultyBand).index(difficulty)),
    )
