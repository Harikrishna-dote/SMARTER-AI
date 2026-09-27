from app.application.language_learning_engine import LanguageLearningEngine
from app.domain.language_learning import (
    LearningSelectionType,
    build_translation_learning_plan,
    detect_selection_type,
)
from app.schemas.translation import TranslationLearningPlanRequest


def test_detect_selection_type_matches_learning_modes() -> None:
    assert detect_selection_type("hello") == LearningSelectionType.WORD
    assert detect_selection_type("How are you?") == LearningSelectionType.SENTENCE
    paragraph = "A learner reads one idea. " * 20
    assert detect_selection_type(paragraph) == LearningSelectionType.PARAGRAPH
    document = "A learner reads one idea. " * 80
    assert detect_selection_type(document) == LearningSelectionType.DOCUMENT


def test_telugu_word_plan_includes_pronunciation_and_storage_policy() -> None:
    plan = build_translation_learning_plan(
        "నమస్తే",
        source_language="te",
        target_language="en",
    )

    assert plan.selection_type == LearningSelectionType.WORD
    assert plan.detected_script == "Telugu"
    assert "slowly" in plan.pronunciation.slow_prompt
    assert "Not stored" in plan.storage_notice


def test_language_learning_engine_returns_api_response() -> None:
    response = LanguageLearningEngine().create_learning_plan(
        TranslationLearningPlanRequest(
            content="I am learning Telugu.",
            source_language="en",
            target_language="te",
            selection_type="sentence",
            store_for_review=True,
        )
    )

    assert response.selection_type == "sentence"
    assert "grammar" in response.skill_focus
    assert "Saved" in response.storage_notice
