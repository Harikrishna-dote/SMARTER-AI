from app.core.config import get_settings
from app.schemas.chat import ChatAttachment, TutorProfile
from app.services.prompt_service import get_prompt_for_subject

MODE_GUIDANCE = {
    "explain": "Explain the idea clearly, then show one worked example and one quick practice question.",
    "solve": "Solve step by step, name the method used, and finish with a short verification.",
    "practice": "Coach the student through practice. Give hints first, then the answer only when helpful.",
    "quiz": "Ask focused quiz questions, wait for the student where appropriate, and include brief feedback.",
    "revise": "Create a compact revision path with formulas, key facts, common mistakes, and examples.",
    "translate": "Translate and teach the answer in the requested language while preserving technical terms.",
}

STYLE_GUIDANCE = {
    "friendly": "Use a friendly, encouraging tone without being childish.",
    "concise": "Keep the response compact and avoid unnecessary background.",
    "step_by_step": "Break reasoning into small numbered steps.",
    "exam_ready": "Prioritize exam patterns, definitions, marks-worthy phrasing, and common traps.",
}


def build_tutor_system_prompt(
    profile: TutorProfile,
    voice_response: bool = False,
    *,
    compact: bool = False,
) -> str:
    language = profile.language or "English"
    language_lower = language.lower()
    bilingual = "bilingual" in language_lower or ("english" in language_lower and "telugu" in language_lower)
    if compact:
        voice_note = " Use short spoken sentences." if voice_response else ""
        language_instruction = "Reply using both English and Telugu naturally" if bilingual else f"Reply in {language}"
        return (
            f"Expert {profile.subject} tutor for {profile.level}. {language_instruction}; "
            f"mode {profile.teaching_mode}, style {profile.response_style}. Be accurate, direct, concise, "
            "stay on the requested subject, cover the essential definition and example, and say when information is uncertain. "
            f"use one useful example and a quick check. Preserve spaces, paragraphs, Markdown, Unicode, "
            f"code indentation, and math notation. Use $...$ or $$...$$ for complex math.{voice_note}"
        )

    subject_prompt = get_prompt_for_subject(profile.subject)

    if bilingual:
        language_rule = (
            "Respond bilingually using natural English and Telugu. Keep the explanation easy to follow, "
            "translate important terms when useful, and preserve the textbook-like structure "
            "(definition -> explanation -> examples -> practice)."
        )
    elif "telugu" in language_lower:
        language_rule = (
            f"Respond strictly in {language}. Do not intersperse English unless absolutely necessary for specific, untranslatable technical terms. "
            "Maintain consistent, professional Telugu throughout the entire explanation. "
            "Ensure the textbook-like structure (definition -> explanation -> examples -> practice) is fully rendered in Telugu."
        )
    else:
        language_rule = (
            f"Respond primarily in {language}. If the student mixes languages, keep the explanation "
            "easy to follow and translate important terms."
        )
    voice_rule = (
        "The answer may be spoken aloud, so use short sentences and avoid huge tables."
        if voice_response
        else "Use readable formatting when it helps the student scan the lesson."
    )
    speed_rule = (
        "Start answering immediately. Give a focused but complete answer with examples."
        if profile.response_speed == "instant"
        else "Give a thorough, detailed answer with examples, step-by-step explanations, and practical applications. Suggest related topics and next steps for the student to explore."
    )
    return "\n".join(
        [
            subject_prompt,
            f"Student level: {profile.level}.",
            f"Teaching mode: {MODE_GUIDANCE.get(profile.teaching_mode, MODE_GUIDANCE['explain'])}",
            f"Response style: {STYLE_GUIDANCE.get(profile.response_style, STYLE_GUIDANCE['friendly'])}",
            language_rule,
            voice_rule,
            speed_rule,
            (
                "Accuracy and coverage contract: teach the requested subject, level, and current question—not a generic adjacent topic. "
                "Cover the main idea, required definitions, dependencies, worked example, common misconception, and a quick check before moving on. "
                "Never invent facts, formulas, citations, experiment results, or syllabus coverage. If reliable context is missing or the question is ambiguous, state the limitation and ask a focused clarification. "
                "For calculations, state assumptions and units, show the method, and verify the result. Distinguish established knowledge from an example or inference."
            ),
            "Never lead with GIFs, videos, or photos. First define and explain with examples; then use visuals as supporting classroom aids.",
            "End with a tiny next step, question, or check when useful.",
        ]
    )


def build_attachment_context(attachments: list[ChatAttachment], max_chars: int | None = None) -> str:
    if not attachments:
        return ""

    max_chars = max_chars or get_settings().max_context_chars
    blocks: list[str] = []
    remaining = max_chars

    for index, attachment in enumerate(attachments, start=1):
        raw_text = "\n".join(
            part
            for part in [
                f"Summary: {attachment.summary}" if attachment.summary else "",
                f"Text: {attachment.text}" if attachment.text else "",
                f"Source URL: {attachment.source_url}" if attachment.source_url else "",
            ]
            if part
        ).strip()
        if not raw_text:
            continue

        snippet = raw_text[:remaining]
        remaining -= len(snippet)
        blocks.append(
            "\n".join(
                [
                    f"Attachment {index}: {attachment.name}",
                    f"Type: {attachment.type}",
                    f"Content type: {attachment.content_type or 'unknown'}",
                    snippet,
                ]
            )
        )
        if remaining <= 0:
            break

    if not blocks:
        return ""
    return "Student supplied learning context:\n\n" + "\n\n".join(blocks)
