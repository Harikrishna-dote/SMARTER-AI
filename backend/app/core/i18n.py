import json
from pathlib import Path
from typing import Any

SUPPORTED_LOCALES = ("en", "te", "hi", "es", "fr", "de", "zh", "ja", "ar")
DEFAULT_LOCALE = "en"

_TRANSLATIONS: dict[str, dict[str, Any]] = {}
_TRANSLATIONS_DIR = Path(__file__).resolve().parent / "translations"


def _load_translations() -> None:
    if _TRANSLATIONS:
        return
    for locale in SUPPORTED_LOCALES:
        path = _TRANSLATIONS_DIR / f"{locale}.json"
        if path.exists():
            with path.open("r", encoding="utf-8") as f:
                _TRANSLATIONS[locale] = json.load(f)


def get_translations(locale: str) -> dict[str, Any]:
    _load_translations()
    if locale in _TRANSLATIONS:
        return _TRANSLATIONS[locale]
    return _TRANSLATIONS.get(DEFAULT_LOCALE, {})


def _get_nested_value(data: dict[str, Any], key: str) -> str | None:
    keys = key.split(".")
    current = data
    for part in keys:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    return str(current) if isinstance(current, str) else None


def t(key: str, locale: str = DEFAULT_LOCALE, **kwargs: Any) -> str:
    translations = get_translations(locale)
    result = _get_nested_value(translations, key)
    if result is None:
        result = _get_nested_value(get_translations(DEFAULT_LOCALE), key)
    if result is None:
        return key
    try:
        return result.format(**kwargs)
    except (KeyError, ValueError):
        return result
