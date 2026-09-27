import os
import sys
from pathlib import Path


ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["AUTO_CREATE_TABLES"] = "false"

from app.schemas.translation import TranslationTextRequest
from app.services.translation_engine import LANGUAGES, TranslationEngine, _clean_json


def test_language_catalog_and_validation():
    assert len(LANGUAGES) >= 100
    assert TranslationEngine.validate_language("te") == "te"
    assert TranslationEngine.validate_language("auto", allow_auto=True) == "auto"


def test_translation_request_defaults_and_json_cleanup():
    request = TranslationTextRequest(content="Hello", target_language="hi")
    assert request.source_language == "auto"
    assert request.tone == "preserve"
    assert _clean_json('```json\n{"translation": "Namaste"}\n```')["translation"] == "Namaste"


def test_long_content_is_split_without_loss():
    content = ("A short paragraph for translation. " * 500).strip()
    chunks = TranslationEngine._split_content(content, max_chars=1000)
    assert len(chunks) > 1
    assert "".join(chunks).replace(" ", "") == content.replace(" ", "")


def test_sentence_breakdown_normalizes_teacher_keys():
    breakdown = TranslationEngine._sentence_breakdown(
        {
            "word_for_word_meanings": [
                {
                    "word": "How",
                    "target": "\u0c0e\u0c32\u0c3e",
                    "romanization": "Ela",
                    "usage": "Question word",
                }
            ],
            "overall_sentence_meaning": "A polite greeting asking about someone's state.",
            "formal": "\u0c0e\u0c32\u0c3e \u0c09\u0c28\u0c4d\u0c28\u0c3e\u0c30\u0c41? (Ela unnaru?)",
            "informal": "\u0c0e\u0c32\u0c3e \u0c09\u0c28\u0c4d\u0c28\u0c3e\u0c35\u0c41? (Ela unnavu?)",
            "grammar": ["Verb ending changes by politeness."],
        },
        original="How are you?",
        translation="\u0c0e\u0c32\u0c3e \u0c09\u0c28\u0c4d\u0c28\u0c3e\u0c30\u0c41?",
    )

    assert breakdown is not None
    assert breakdown.word_by_word[0].source == "How"
    assert breakdown.word_by_word[0].translation == "\u0c0e\u0c32\u0c3e"
    assert breakdown.word_by_word[0].transliteration == "Ela"
    assert breakdown.formal_version.endswith("(Ela unnaru?)")
    assert breakdown.grammar_notes == ["Verb ending changes by politeness."]
