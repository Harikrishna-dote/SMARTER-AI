from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


TranslationTone = Literal[
    "preserve",
    "natural",
    "formal",
    "casual",
    "professional",
    "academic",
    "friendly",
    "technical",
]


class LanguageOption(BaseModel):
    code: str
    name: str
    native_name: str


class WordMeaning(BaseModel):
    source: str
    meaning: str = ""
    translation: str = ""
    transliteration: str = ""
    note: str = ""


class SentenceBreakdown(BaseModel):
    original: str = ""
    translation: str = ""
    word_by_word: list[WordMeaning] = Field(default_factory=list)
    overall_meaning: str = ""
    formal_version: str = ""
    informal_version: str = ""
    natural_version: str = ""
    grammar_notes: list[str] = Field(default_factory=list)


class TranslationTextRequest(BaseModel):
    content: str = Field(min_length=1, max_length=50000)
    source_language: str = Field(default="auto", min_length=2, max_length=16)
    target_language: str = Field(min_length=2, max_length=16)
    tone: TranslationTone = "preserve"
    preserve_formatting: bool = True
    include_alternatives: bool = True
    context: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def different_languages(self) -> "TranslationTextRequest":
        if self.source_language != "auto" and self.source_language == self.target_language:
            raise ValueError("Source and target languages must be different")
        return self


class TranslationTextResponse(BaseModel):
    original_content: str
    translated_content: str
    source_language: str
    detected_source_language: str
    target_language: str
    tone: TranslationTone
    transliteration: str = ""
    alternatives: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    sentence_breakdown: SentenceBreakdown | None = None
    confidence_score: float = Field(ge=0, le=1)
    time_taken_seconds: float = Field(ge=0)
    character_count: int = Field(ge=0)


class PronunciationPlanResponse(BaseModel):
    normal_prompt: str
    slow_prompt: str
    practice_steps: list[str] = Field(default_factory=list)
    common_mistakes: list[str] = Field(default_factory=list)


class TranslationLearningPlanRequest(BaseModel):
    content: str = Field(min_length=1, max_length=50000)
    source_language: str = Field(default="auto", min_length=2, max_length=16)
    target_language: str = Field(min_length=2, max_length=16)
    selection_type: Literal["word", "sentence", "paragraph", "document"] | None = None
    store_for_review: bool = False


class TranslationLearningPlanResponse(BaseModel):
    selection_type: Literal["word", "sentence", "paragraph", "document"]
    detected_script: str
    skill_focus: list[str] = Field(default_factory=list)
    teaching_sequence: list[str] = Field(default_factory=list)
    pronunciation: PronunciationPlanResponse
    vocabulary_targets: list[str] = Field(default_factory=list)
    grammar_targets: list[str] = Field(default_factory=list)
    practice_prompts: list[str] = Field(default_factory=list)
    storage_notice: str


class GrammarRequest(BaseModel):
    content: str = Field(min_length=1, max_length=20000)
    language: str = Field(default="auto", min_length=2, max_length=16)
    goal: Literal["correct", "polish", "simplify", "professional", "friendly"] = "correct"


class GrammarResponse(BaseModel):
    original_content: str
    corrected_content: str
    language: str
    explanation: list[str] = Field(default_factory=list)


class AnalysisRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    source_language: str = Field(default="auto", min_length=2, max_length=16)
    target_language: str = Field(min_length=2, max_length=16)
    analysis_type: Literal["word", "sentence"] = "word"


class WordAnalysis(BaseModel):
    original: str
    pronunciation: str = ""
    ipa: str = ""
    meaning: str = ""
    translation: str = ""
    part_of_speech: str = ""
    root_word: str = ""
    synonyms: list[str] = Field(default_factory=list)
    antonyms: list[str] = Field(default_factory=list)
    examples: list[str] = Field(default_factory=list)
    usage: str = ""
    difficulty: str = ""
    frequency: str = ""
    related_words: list[str] = Field(default_factory=list)
    word_origin: str = ""
    formal_usage: str = ""
    informal_usage: str = ""


class SentenceAnalysis(BaseModel):
    original: str
    translation: str = ""
    word_by_word: list[WordMeaning] = Field(default_factory=list)
    grammar: list[str] = Field(default_factory=list)
    grammar_notes: list[str] = Field(default_factory=list)
    meaning: str = ""
    overall_meaning: str = ""
    context: str = ""
    alternatives: list[str] = Field(default_factory=list)
    formal_version: str = ""
    informal_version: str = ""
    natural_version: str = ""
    professional_version: str = ""
    simple_version: str = ""
    spoken_version: str = ""
    sentence_structure: str = ""
    similar_sentences: list[str] = Field(default_factory=list)


class AnalysisResponse(BaseModel):
    analysis_type: Literal["word", "sentence"]
    detected_source_language: str
    word: WordAnalysis | None = None
    sentence: SentenceAnalysis | None = None


class TranslationHistoryItem(BaseModel):
    id: str
    source_language: str
    target_language: str
    original_content: str
    translated_content: str
    mode: str
    created_at: str
    character_count: int


class VocabularyItemResponse(BaseModel):
    id: str
    word: str
    translation: str
    source_language: str
    target_language: str
    pronunciation: str = ""
    ipa: str = ""
    part_of_speech: str = ""
    synonyms: list[str] = Field(default_factory=list)
    antonyms: list[str] = Field(default_factory=list)
    examples: list[str] = Field(default_factory=list)
    difficulty: str = "medium"
    mastery: int = 0
    review_count: int = 0
    last_reviewed: str = ""
    created_at: str = ""


class FlashcardResponse(BaseModel):
    id: str
    front: str
    back: str
    source_language: str
    target_language: str
    difficulty: str = "medium"
    ease_factor: int = 2500
    interval: int = 0
    repetitions: int = 0
    due_date: str = ""
    created_at: str = ""


class BookmarkResponse(BaseModel):
    id: str
    original_text: str
    translated_text: str
    source_language: str
    target_language: str
    note: str = ""
    tags: str = ""
    created_at: str = ""


class SavedPhraseResponse(BaseModel):
    id: str
    phrase: str
    translation: str
    source_language: str
    target_language: str
    context: str = ""
    category: str = "general"
    usage_count: int = 0
    created_at: str = ""


class OCRBox(BaseModel):
    text: str
    translation: str = ""
    x: int
    y: int
    width: int
    height: int
    element_type: str = "word"
    confidence: int = 0


class OCRResponse(BaseModel):
    text: str
    boxes: list[OCRBox] = Field(default_factory=list)
    language: str = "auto"
    mode: str = "image"


class QuizQuestionSchema(BaseModel):
    question: str
    options: list[str] = Field(default_factory=list)
    answer: str
    explanation: str


class QuizResponse(BaseModel):
    id: str
    topic: str
    source_language: str
    target_language: str
    questions: list[QuizQuestionSchema] = Field(default_factory=list)
    score: int = 0
    total: int = 0
    completed: bool = False
    created_at: str = ""


class ExplainRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10000)
    source_language: str = Field(default="auto", min_length=2, max_length=16)
    target_language: str = Field(min_length=2, max_length=16)
    focus: Literal["grammar", "vocabulary", "usage", "culture", "all"] = "all"


class ExplainResponse(BaseModel):
    original: str
    translation: str
    why_correct: list[str] = Field(default_factory=list)
    grammar_rules: list[str] = Field(default_factory=list)
    vocabulary_notes: list[str] = Field(default_factory=list)
    real_life_usage: list[str] = Field(default_factory=list)
    common_mistakes: list[str] = Field(default_factory=list)
    better_alternatives: list[str] = Field(default_factory=list)


class PronunciationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: str = Field(default="en", min_length=2, max_length=16)
    speed: Literal["slow", "normal", "fast"] = "normal"


class FlashcardGenerateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10000)
    source_language: str = Field(default="auto", min_length=2, max_length=16)
    target_language: str = Field(min_length=2, max_length=16)
    count: int = Field(default=5, ge=1, le=20)


class QuizGenerateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10000)
    source_language: str = Field(default="auto", min_length=2, max_length=16)
    target_language: str = Field(min_length=2, max_length=16)
    count: int = Field(default=5, ge=1, le=20)
    types: list[str] = Field(default_factory=lambda: ["mcq", "true_false", "fill_blank"])


class OCRSelectRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50000)
    selection_type: Literal["word", "sentence", "paragraph"] = "sentence"
    source_language: str = Field(default="auto", min_length=2, max_length=16)
    target_language: str = Field(min_length=2, max_length=16)


class TranslationMode(str, Enum):
    TEXT = "text"
    VOICE = "voice"
    DOCUMENT = "document"
    IMAGE = "image"
    OCR = "ocr"
    LIVE_CONVERSATION = "live_conversation"
    CAMERA = "camera"
    SCREENSHOT = "screenshot"
    PDF = "pdf"


class ContentType(str, Enum):
    PLAIN_TEXT = "plain_text"
    MARKDOWN = "markdown"
    HTML = "html"
    PDF = "pdf"
    DOCX = "docx"
    AUDIO_MP3 = "audio/mp3"
    AUDIO_WAV = "audio/wav"
    IMAGE_JPG = "image/jpg"
    IMAGE_PNG = "image/png"


class ToneStyle(str, Enum):
    PRESERVE = "preserve"
    NATURAL = "natural"
    FORMAL = "formal"
    INFORMAL = "casual"
    CONVERSATIONAL = "friendly"
    ACADEMIC = "academic"
    TECHNICAL = "technical"
    PROFESSIONAL = "professional"


class TranslationRequest(BaseModel):
    source_language: str
    target_language: str
    content: str
    mode: TranslationMode = TranslationMode.TEXT
    content_type: ContentType = ContentType.PLAIN_TEXT
    tone: ToneStyle | None = ToneStyle.PRESERVE
    preserve_formatting: bool = True
    context_aware: bool = True


TranslationResult = TranslationTextResponse


class VoiceTranslationResult(BaseModel):
    translated_text: str
    original_text: str
    source_language: str
    target_language: str
    audio_url: str | None = None


__all__ = [
    "AnalysisRequest",
    "AnalysisResponse",
    "BookmarkResponse",
    "ContentType",
    "ExplainRequest",
    "ExplainResponse",
    "FlashcardGenerateRequest",
    "FlashcardResponse",
    "GrammarRequest",
    "GrammarResponse",
    "LanguageOption",
    "OCRBox",
    "OCRResponse",
    "OCRSelectRequest",
    "PronunciationPlanResponse",
    "PronunciationRequest",
    "QuizGenerateRequest",
    "QuizQuestionSchema",
    "QuizResponse",
    "SavedPhraseResponse",
    "SentenceBreakdown",
    "SentenceAnalysis",
    "ToneStyle",
    "TranslationHistoryItem",
    "TranslationMode",
    "TranslationRequest",
    "TranslationResult",
    "TranslationLearningPlanRequest",
    "TranslationLearningPlanResponse",
    "TranslationTextRequest",
    "TranslationTextResponse",
    "TranslationTone",
    "VocabularyItemResponse",
    "VoiceTranslationResult",
    "WordAnalysis",
    "WordMeaning",
]
