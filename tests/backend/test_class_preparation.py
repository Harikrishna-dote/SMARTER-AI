import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.domain.tutor.class_preparation import (  # noqa: E402
    compare_curriculum,
    compile_prepared_content,
    extract_syllabus_topics,
    merge_topics,
)


def test_syllabus_extraction_uses_source_lines_without_inventing_topics():
    text = """Physics syllabus\nUnit 1: Motion\n- Distance and displacement\n- Newton's laws\nPage 2"""

    assert extract_syllabus_topics(text) == ["Physics syllabus", "Motion", "Distance and displacement", "Newton's laws"]


def test_board_scene_has_concept_linked_animation_and_safe_controls():
    scene = compile_prepared_content(
        {"outline": [{"title": "Newton's second law", "content": "Force equals mass times acceleration."}]},
        ["Newton's second law"],
        "en",
    )["board_scenes"][0]

    assert scene["animation"]["kind"] == "motion"
    assert {item["id"] for item in scene["interactions"]} == {"force", "mass"}


def test_curriculum_comparison_exposes_matches_gaps_and_additions():
    result = compare_curriculum(
        ["Motion", "Newton's laws", "Waves"],
        ["Motion and displacement", "Newton laws", "Energy"],
    )

    assert result["counts"]["partial_match"] >= 1
    assert result["counts"]["missing_from_ai_plan"] == 1
    assert result["counts"]["missing_from_student_syllabus"] == 1


def test_merge_topics_deduplicates_only_near_identical_items():
    merged = merge_topics(["Newton's laws", "Waves"], ["Newton laws", "Energy"], "merged")

    assert merged == ["Newton's laws", "Waves", "Energy"]


def test_prepared_content_is_declarative_and_contains_board_scenes():
    content = compile_prepared_content(
        {
            "title": "Motion",
            "outline": [{"title": "Velocity", "content": "Velocity = distance / time"}],
        },
        ["Velocity"],
        "bilingual",
    )

    assert content["board_scenes"][0]["visual_type"] == "formula"
    assert content["board_scenes"][0]["events"][0]["type"] == "highlight"
    assert content["curriculum_tree"]["modules"]
    assert content["curriculum_tree"]["modules"][0]["chapters"][0]["topics"][0]["subtopics"]
    assert "javascript" not in str(content).lower()


def test_prepared_content_never_skips_requested_curriculum_topics():
    content = compile_prepared_content(
        {"outline": [{"title": "Motion", "content": "Motion changes position over time."}]},
        ["Motion", "Newton's laws", "Waves"],
        "bilingual",
    )

    assert [scene["topic"] for scene in content["board_scenes"]] == ["Motion", "Newton's laws", "Waves"]
    assert content["coverage"]["complete"] is True
    assert content["coverage"]["missing_topics"] == []
    assert content["coverage"]["fallback_topics"] == ["Newton's laws", "Waves"]
    tree_topics = [
        topic["title"]
        for module in content["curriculum_tree"]["modules"]
        for chapter in module["chapters"]
        for topic in chapter["topics"]
    ]
    assert tree_topics == ["Motion", "Newton's laws", "Waves"]
