import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["AUTO_CREATE_TABLES"] = "false"

import app.api.assessment.router as assessment_router
from app.application.assessment_engine import AssessmentEngine
from app.domain.assessment import (
    AssessmentActivityType,
    DifficultyBand,
    MasteryBand,
    build_assessment_plan,
    estimate_mastery_band,
)
from app.schemas.assessment import AssessmentPlanRequest


def test_mastery_band_drives_adaptive_difficulty() -> None:
    assert estimate_mastery_band(42) == MasteryBand.NEEDS_SUPPORT
    assert estimate_mastery_band(68) == MasteryBand.PRACTICING
    assert estimate_mastery_band(78) == MasteryBand.PROFICIENT
    assert estimate_mastery_band(92) == MasteryBand.ADVANCED

    plan = build_assessment_plan(
        topic="Algebra",
        activity_type=AssessmentActivityType.ADAPTIVE_QUIZ,
        recent_accuracy=78,
    )

    assert plan.difficulty == DifficultyBand.HARD
    assert "case_study" in plan.question_types
    assert "mistake_patterns" in plan.analytics_signals


def test_exam_simulation_uses_realistic_exam_policy() -> None:
    plan = build_assessment_plan(
        topic="Digital Electronics",
        subject="electronics",
        activity_type=AssessmentActivityType.EXAM_SIMULATION,
        recent_accuracy=88,
        exam_name="GATE",
    )

    assert plan.duration_minutes == 180
    assert plan.negative_marking is True
    assert any("GATE" in section for section in plan.sections)
    assert "logical_reasoning" in plan.question_types


def test_project_coding_and_virtual_labs_have_specialized_briefs() -> None:
    project = build_assessment_plan(
        topic="Machine Learning",
        activity_type=AssessmentActivityType.PROJECT_LAB,
    )
    coding = build_assessment_plan(
        topic="Binary Search",
        activity_type=AssessmentActivityType.CODING_LAB,
        coding_language="python",
    )
    virtual = build_assessment_plan(
        topic="Projectile Motion",
        subject="physics",
        activity_type=AssessmentActivityType.VIRTUAL_LAB,
    )

    assert project.project_brief is not None
    assert "implementation" in project.project_brief.deliverables
    assert coding.coding_lab is not None
    assert coding.coding_lab.language == "python"
    assert "security risks" in coding.coding_lab.review_focus
    assert virtual.virtual_lab is not None
    assert virtual.virtual_lab.lab_type == "science_simulation"


def test_assessment_engine_returns_api_response() -> None:
    response = AssessmentEngine().create_plan(
        AssessmentPlanRequest(
            topic="System Design",
            activity_type="career_prep",
            recent_accuracy=70,
        )
    )

    assert response.activity_type == "career_prep"
    assert response.mastery_band == "proficient"
    assert "system_design" in response.question_types
    assert response.xp_reward > 0


@pytest.mark.asyncio
async def test_assessment_plan_route_preserves_contract() -> None:
    response = await assessment_router.create_assessment_plan(
        AssessmentPlanRequest(
            topic="Arrays",
            activity_type="coding_lab",
            coding_language="javascript",
            requested_difficulty="medium",
        ),
        current_user=SimpleNamespace(id="user-1"),
    )

    assert response.activity_type == "coding_lab"
    assert response.difficulty == "medium"
    assert response.coding_lab is not None
    assert response.coding_lab.language == "javascript"
