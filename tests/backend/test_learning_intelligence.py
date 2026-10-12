import json

from app.domain.tutor.learning_intelligence import (
    MasteryStatus,
    VisualStrategy,
    build_adaptive_teaching_context,
    classify_learning_request,
    update_topic_mastery,
    validate_visualization_spec,
)


def test_classification_selects_trusted_strategy_for_programming() -> None:
    result = classify_learning_request(
        "Trace this Python recursion and show the return values",
        subject="programming",
        topic="recursion",
    )

    assert result.task == "explain"
    assert result.visual_strategy == VisualStrategy.CODE_TRACE
    assert "verified_output" in result.variables


def test_mastery_retains_evidence_and_does_not_reset_after_one_mistake() -> None:
    first = update_topic_mastery({}, score=92, evidence_type="quiz")
    second = update_topic_mastery(first, score=0, hints_used=1, evidence_type="quiz")

    assert second["attempts"] == 2
    assert second["score"] > 45
    assert len(second["evidence"]) == 2
    assert second["status"] != MasteryStatus.NOT_ASSESSED


def test_insufficient_evidence_is_explicit_in_teaching_context() -> None:
    context = build_adaptive_teaching_context("quadratic equations")

    assert "insufficient topic-specific evidence" in context
    assert "intelligence" in context


def test_visualization_spec_is_bounded_and_rejects_unknown_modes() -> None:
    spec = validate_visualization_spec(
        {
            "mode": "math_graph",
            "title": "Quadratic graph",
            "elements": [{"type": "axes"}],
            "animation_steps": [{"id": "1", "duration_ms": 1200}],
        }
    )

    assert spec["mode"] == "math_graph"
    assert spec["animation_steps"][0]["duration_ms"] == 1200

    try:
        validate_visualization_spec({"mode": "execute_javascript", "elements": [], "animation_steps": []})
    except ValueError as exc:
        assert "Unsupported visualization mode" in str(exc)
    else:
        raise AssertionError("untrusted visualization mode was accepted")


def test_mastery_record_is_json_serializable() -> None:
    record = update_topic_mastery({}, score=75, evidence_type="homework")
    assert json.loads(json.dumps(record))["score"] == 75.0
