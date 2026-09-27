from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest

from app.services.ai_gateway import AIGateway
from app.services.providers.gemini_provider import GeminiProvider


@pytest.mark.asyncio
async def test_chat_uses_gemini_when_api_key_is_configured():
    settings = SimpleNamespace(
        gemini_api_key="test-key",
        gemini_model="gemini-2.0-flash",
        ollama_base_url="http://localhost:11434",
        model_fallback_chains={"general": ["gemini-2.0-flash"]},
    )

    with patch("app.services.ai_gateway.get_settings", return_value=settings):
        gateway = AIGateway()
        gateway.gemini = AsyncMock(spec=GeminiProvider)
        gateway.gemini.is_enabled.return_value = True
        gateway.gemini.chat.return_value = "Gemini reply"
        
        reply = await gateway.chat([{"role": "user", "content": "Hello"}])

    assert reply == "Gemini reply"
    gateway.gemini.chat.assert_called_once()
