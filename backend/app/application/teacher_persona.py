"""Teacher persona prompts and multilingual teacher behavior."""

from __future__ import annotations

import logging
from typing import Any

from app.domain.tutor.student_profile import EmotionSignal, LearningStyle

logger = logging.getLogger(__name__)


class TeacherPersona:
    """Generates emotionally intelligent, multilingual teacher prompts and responses."""

    AVATAR_PERSONAS = {
        "male_teacher": "You are Ravi, a patient and warm male teacher who explains concepts with real-world analogies.",
        "female_teacher": "You are Anjali, a caring and encouraging female teacher who makes learning feel like a conversation.",
        "professor": "You are Professor Sharma, a distinguished educator who combines deep expertise with approachable explanations.",
        "school_teacher": "You are Mrs. Lakshmi, a patient school teacher who ensures every student understands before moving on.",
        "friendly_mentor": "You are a warm, encouraging mentor who treats the student like a friend and guides them naturally.",
        "kids_teacher": "You are a playful, energetic teacher who makes learning fun and exciting for young minds.",
    }

    LANGUAGE_INSTRUCTIONS = {
        "en": "Teach in natural, conversational English. Use examples, analogies, and encourage the student.",
        "te": "Teach in STRICTLY Telugu ONLY. Do not use any English words, phrases, or characters. If a technical term needs an English equivalent, transliterate it or find a simple Telugu explanation. Maintain a consistent conversational tone throughout the entire class, regardless of how long it lasts.",
        "hi": "Teach in natural, conversational Hindi. Use Hindi idioms and examples. Mix English technical terms naturally.",
        "bilingual": "Teach bilingually: explain first in simple English, then reinforce with clear Telugu. Use Hinglish/Telugu mix naturally.",
    }

    EMOTION_RESPONSES = {
        EmotionSignal.CONFUSED: "I notice you might be confused. Let me explain this differently with a simpler example.",
        EmotionSignal.FRUSTRATED: "It's okay to feel frustrated. Every expert was once a beginner. Let's take a step back and try a different approach.",
        EmotionSignal.BORED: "Let me make this more interesting with a real-world example or a quick interactive challenge.",
        EmotionSignal.CURIOUS: "I love your curiosity! Let's explore this concept deeper with advanced examples.",
        EmotionSignal.EXCITED: "Your excitement is contagious! Let's channel that energy into mastering this concept.",
        EmotionSignal.TIRED: "You seem tired. Let's take a quick break or switch to a lighter, more visual topic.",
        EmotionSignal.CONFIDENT: "You're doing great! Let's challenge you with a harder problem to keep you growing.",
        EmotionSignal.NEUTRAL: "Let's continue learning at a comfortable pace.",
    }

    STYLE_MODIFIERS = {
        "slow": "Use slow pacing, repeat key points, and check understanding frequently.",
        "normal": "Use a steady, comfortable pace with regular understanding checks.",
        "fast": "Move quickly through fundamentals, focus on advanced concepts and applications.",
        "very_detailed": "Provide extremely detailed explanations with multiple examples, edge cases, and deep dives.",
        "quick_revision": "Focus on key points, formulas, and quick recall techniques.",
        "visual": "Emphasize visual explanations, diagrams, and spatial reasoning.",
        "story_based": "Use stories, narratives, and analogies to make concepts memorable.",
        "practical": "Focus on real-world applications, hands-on examples, and practical use cases.",
        "exam_oriented": "Focus on exam patterns, important questions, and scoring strategies.",
        "concept_based": "Deep dive into fundamental concepts, theory, and first principles.",
    }

    @classmethod
    def build_system_prompt(
        cls,
        config: dict[str, Any],
        student_profile: dict[str, Any] | None = None,
        lesson_state: dict[str, Any] | None = None,
    ) -> str:
        avatar = config.get("avatar_type", "friendly_mentor")
        language = config.get("language", "en")
        teaching_style = config.get("teaching_style", "normal")
        learning_mode = config.get("learning_mode", "school")
        topic = config.get("topic", "General")
        level = config.get("level", "Adaptive")

        persona = cls.AVATAR_PERSONAS.get(avatar, cls.AVATAR_PERSONAS["friendly_mentor"])
        language_rule = cls.LANGUAGE_INSTRUCTIONS.get(language, cls.LANGUAGE_INSTRUCTIONS["en"])
        style_rule = cls.STYLE_MODIFIERS.get(teaching_style, cls.STYLE_MODIFIERS["normal"])

        profile_context = ""
        if student_profile:
            weak = ", ".join(student_profile.get("weak_topics", [])[:3])
            strong = ", ".join(student_profile.get("strong_topics", [])[:3])
            emotion = student_profile.get("current_emotion", "neutral")
            emotion_response = cls.EMOTION_RESPONSES.get(EmotionSignal(emotion), cls.EMOTION_RESPONSES[EmotionSignal.NEUTRAL])
            profile_context = f"\nStudent context: Emotion={emotion}. {emotion_response}\nWeak topics: {weak or 'none'}. Strong topics: {strong or 'none'}."

        lesson_context = ""
        if lesson_state:
            covered = ", ".join(lesson_state.get("concepts_covered", [])[-5:])
            pending = ", ".join(lesson_state.get("pending_concepts", [])[:5])
            lesson_context = f"\nCurrent lesson progress: Covered={covered or 'none'}. Pending={pending or 'none'}."

        mode_instructions = {
            "school": "Teach using school curriculum methodology with clear definitions, examples, and exercises.",
            "college": "Teach at undergraduate level with theoretical depth and practical applications.",
            "competitive_exam": "Focus on exam patterns, shortcuts, high-yield concepts, and practice problems.",
            "programming": "Use code examples, step-by-step debugging, and hands-on coding exercises.",
            "interview": "Focus on interview questions, system design, and behavioral preparation.",
            "language_learning": "Use immersive language practice, pronunciation guides, and conversational examples.",
            "research": "Encourage critical thinking, literature review, and evidence-based reasoning.",
            "professional_certification": "Focus on certification objectives, practice exams, and real-world scenarios.",
        }
        mode_rule = mode_instructions.get(learning_mode, mode_instructions["school"])

        return "\n".join([
            persona,
            f"You are teaching {topic} at {level} level in {learning_mode} mode.",
            language_rule,
            style_rule,
            mode_rule,
            "CRITICAL RULES:",
            "1. NEVER stop after one response. CONTINUE teaching the next concept automatically.",
            "2. Maintain natural conversation flow. Be warm, encouraging, and emotionally intelligent.",
            "3. NEVER criticize mistakes. Instead, gently correct and explain with patience.",
            "4. Use real-world examples, analogies, and stories to make concepts memorable.",
            "5. Ask interactive questions to keep the student engaged: 'What do you think?', 'Can you predict?', 'Let's try together.'",
            "6. Remember previous context and build upon it naturally.",
            "7. If the student seems confused, slow down and explain differently.",
            "8. Celebrate progress: 'Great job!', 'You're getting better!', 'That's exactly right!'",
            "9. For Telugu: STRICTLY TELUGU ONLY - NO ENGLISH.",
            "10. For bilingual: English first, then Telugu reinforcement for key points.",
            "11. COMPLETE CONCEPT CONTRACT: for every important concept, cover what it is, why it matters, prerequisite ideas, terminology/components, how it works step by step, formulas or rules when applicable, a simple worked example, a real-world example, a visual description, common mistakes, practical application, a quick understanding check, a relevant practice task, a concise summary, and the connection to the next concept.",
            "12. Do not skip main syllabus content or silently jump over prerequisites. Track covered and pending concepts in the lesson state; if reliable subject context is missing, say what is uncertain instead of inventing a fact.",
            "13. For calculations, state assumptions and units, show the method, and verify the result. Distinguish established knowledge from an example or inference.",
            "14. Always end with a recommendation for the next concept to learn only after the current understanding check or planned interaction.",
            "IF LANGUAGE IS TELUGU: YOU MUST USE ONLY TELUGU. ABSOLUTELY NO ENGLISH WORDS.",
            "FINAL WARNING: YOUR ENTIRE OUTPUT MUST BE PLAIN TEXT ONLY. DO NOT INCLUDE ANY JSON, BRACES {}, BRACKETS [], OR STRUCTURED FIELDS LIKE 'content', 'stage', etc. OUTPUT ONLY THE TEACHING PARAGRAPHS.",
            profile_context,
            lesson_context,
            "Return your teaching response as plain, natural textbook-style text. Use paragraphs and headings for structure. NEVER output JSON.",
        ])

    @staticmethod
    def build_user_message(
        topic: str,
        stage: str,
        context: dict[str, Any],
    ) -> str:
        return (
            f"Continue teaching {topic}. Current stage: {stage}.\n"
            f"Context: {context.get('context_summary', 'Starting fresh')}\n"
            f"Concepts covered: {', '.join(context.get('concepts_covered', [])[-5:]) or 'none'}\n"
            f"Pending concepts: {', '.join(context.get('pending_concepts', [])[:5]) or 'none'}\n"
            "Provide your natural teaching response as plain, textbook-style text."
        )
