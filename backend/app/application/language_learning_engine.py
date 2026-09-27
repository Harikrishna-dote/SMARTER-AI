"""Application use cases for translation-based language learning."""

from app.domain.language_learning import (
    LearningSelectionType,
    TranslationLearningPlan,
    build_translation_learning_plan,
)
from app.schemas.translation import TranslationLearningPlanRequest, TranslationLearningPlanResponse


class LanguageLearningEngine:
    def create_learning_plan(self, request: TranslationLearningPlanRequest) -> TranslationLearningPlanResponse:
        selection_type = (
            LearningSelectionType(request.selection_type)
            if request.selection_type
            else None
        )
        plan = build_translation_learning_plan(
            request.content,
            source_language=request.source_language,
            target_language=request.target_language,
            selection_type=selection_type,
            store_for_review=request.store_for_review,
        )
        return self._to_response(plan)

    @staticmethod
    def _to_response(plan: TranslationLearningPlan) -> TranslationLearningPlanResponse:
        return TranslationLearningPlanResponse(
            selection_type=plan.selection_type.value,
            detected_script=plan.detected_script,
            skill_focus=[focus.value for focus in plan.skill_focus],
            teaching_sequence=list(plan.teaching_sequence),
            pronunciation={
                "normal_prompt": plan.pronunciation.normal_prompt,
                "slow_prompt": plan.pronunciation.slow_prompt,
                "practice_steps": list(plan.pronunciation.practice_steps),
                "common_mistakes": list(plan.pronunciation.common_mistakes),
            },
            vocabulary_targets=list(plan.vocabulary_targets),
            grammar_targets=list(plan.grammar_targets),
            practice_prompts=list(plan.practice_prompts),
            storage_notice=plan.storage_notice,
        )

