import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.wake_word import detect_wake_word, extract_wake_command, strip_wake_word  # noqa: E402


def test_wake_word_extracts_english_and_mixed_requests():
    assert detect_wake_word("Smart, why is acceleration increasing?")
    assert extract_wake_command("Smart, naaku idi ardham kaaledu") == "naaku idi ardham kaaledu"
    assert strip_wake_word("hey Smart: Telugu lo cheppu") == "Telugu lo cheppu"


def test_wake_word_does_not_consume_ordinary_words_or_empty_requests():
    assert not detect_wake_word("smartphone battery")
    assert extract_wake_command("Smart") is None
    assert strip_wake_word("Explain Newton's second law") == "Explain Newton's second law"
