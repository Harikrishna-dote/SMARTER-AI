"""Application use cases for assessment and career-readiness planning."""

from app.domain.assessment import (
    AssessmentActivityType,
    AssessmentPlan,
    DifficultyBand,
    build_assessment_plan,
)
from app.schemas.assessment import (
    AssessmentPlanRequest,
    AssessmentPlanResponse,
    CodingLabBriefResponse,
    ProjectBriefResponse,
    VirtualLabBriefResponse,
)


class AssessmentEngine:
    def create_plan(self, request: AssessmentPlanRequest) -> AssessmentPlanResponse:
        requested_difficulty = (
            None
            if request.requested_difficulty == "adaptive"
            else DifficultyBand(request.requested_difficulty)
        )
        plan = build_assessment_plan(
            topic=request.topic,
            subject=request.subject,
            activity_type=AssessmentActivityType(request.activity_type),
            recent_accuracy=request.recent_accuracy,
            completed_items=request.completed_items,
            exam_name=request.exam_name or "",
            requested_difficulty=requested_difficulty,
            coding_language=request.coding_language,
            duration_minutes=request.duration_minutes,
        )
        return self._to_response(plan)

    @staticmethod
    def _to_response(plan: AssessmentPlan) -> AssessmentPlanResponse:
        return AssessmentPlanResponse(
            topic=plan.topic,
            subject=plan.subject,
            activity_type=plan.activity_type.value,
            mastery_band=plan.mastery_band.value,
            difficulty=plan.difficulty.value,
            question_types=list(plan.question_types),
            sections=list(plan.sections),
            duration_minutes=plan.duration_minutes,
            negative_marking=plan.negative_marking,
            practice_mix=list(plan.practice_mix),
            project_brief=(
                ProjectBriefResponse(
                    objective=plan.project_brief.objective,
                    deliverables=list(plan.project_brief.deliverables),
                    evaluation_criteria=list(plan.project_brief.evaluation_criteria),
                    portfolio_tip=plan.project_brief.portfolio_tip,
                )
                if plan.project_brief
                else None
            ),
            coding_lab=(
                CodingLabBriefResponse(
                    language=plan.coding_lab.language,
                    starter_tasks=list(plan.coding_lab.starter_tasks),
                    review_focus=list(plan.coding_lab.review_focus),
                    safety_checks=list(plan.coding_lab.safety_checks),
                )
                if plan.coding_lab
                else None
            ),
            virtual_lab=(
                VirtualLabBriefResponse(
                    lab_type=plan.virtual_lab.lab_type,
                    simulation_focus=list(plan.virtual_lab.simulation_focus),
                    safety_rules=list(plan.virtual_lab.safety_rules),
                    observation_tasks=list(plan.virtual_lab.observation_tasks),
                )
                if plan.virtual_lab
                else None
            ),
            career_actions=list(plan.career_actions),
            analytics_signals=list(plan.analytics_signals),
            accessibility_support=list(plan.accessibility_support),
            security_notes=list(plan.security_notes),
            evaluation_rubric=list(plan.evaluation_rubric),
            next_steps=list(plan.next_steps),
            xp_reward=plan.xp_reward,
        )
