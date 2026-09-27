from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from .i18n import SUPPORTED_LOCALES, t


def detect_locale(accept_language_header: Optional[str]) -> str:
    if not accept_language_header:
        return "en"
    languages = re.split(r"[,;]", accept_language_header)
    for lang in languages:
        lang = lang.strip().lower()
        if not lang:
            continue
        parts = lang.split("-")
        base = parts[0]
        if base in SUPPORTED_LOCALES:
            return base
    return "en"


def localize_datetime(dt: datetime, locale: str) -> str:
    if locale == "te":
        return dt.strftime("%d-%m-%Y %I:%M %p")
    if locale == "hi":
        return dt.strftime("%d/%m/%Y %I:%M %p")
    if locale in ("zh", "ja"):
        return dt.strftime("%Y-%m-%d %H:%M")
    return dt.strftime("%b %d, %Y %I:%M %p")


def localize_number(number: float, locale: str) -> str:
    if locale == "te":
        return f"{number:,.2f}".replace(",", " ").replace(".", ",")
    if locale == "de":
        return f"{number:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{number:,.2f}"


def localize_currency(amount: float, currency: str, locale: str) -> str:
    formatted = localize_number(amount, locale)
    symbols = {
        "USD": "$",
        "EUR": "€",
        "GBP": "£",
        "INR": "₹",
        "JPY": "¥",
        "CNY": "¥",
    }
    symbol = symbols.get(currency, currency)
    if locale == "te":
        return f"{symbol} {formatted}"
    return f"{symbol}{formatted}"
