import pytest
from unittest.mock import AsyncMock, patch
from app.application.ai_brain_adapter import AIBrainAdapter
from app.domain.ai_brain import AgentCapability
from app.orchestration.orchestrator import AIOrchestrator
from app.services.ai_gateway import AIGateway
from app.services.providers.gemini_provider import GeminiProvider
from app.services.providers.ollama_provider import OllamaProvider

@pytest.mark.asyncio
async def test_orchestrator_routes_to_gemini():
    # Setup
    gateway = AIGateway()
    # Mock providers inside gateway
    gateway.gemini = AsyncMock(spec=GeminiProvider)
    gateway.gemini.is_enabled.return_value = True
    gateway.gemini.chat.return_value = "Gemini response"
    
    # Mock model router to return a Gemini model
    with patch.object(gateway.model_router, 'select_route', return_value=AsyncMock(selected_model='gemini-2.0-flash')):
        orchestrator = AIOrchestrator(gateway)
        
        # Execute
        response = await orchestrator.execute_request("user1", [{"role": "user", "content": "Hello"}], task_type="general")
        
        # Assert
        assert response == "Gemini response"
        gateway.gemini.chat.assert_called_once()

@pytest.mark.asyncio
async def test_orchestrator_routes_to_ollama_for_coding():
    # Setup
    gateway = AIGateway()
    # Mock providers inside gateway
    gateway.ollama = AsyncMock(spec=OllamaProvider)
    gateway.ollama.chat.return_value = "Ollama code response"
    
    # Mock health manager inside router to ensure routing happens
    with patch.object(gateway.model_router.health, 'selectable_model', return_value="qwen2.5-coder:7b"):
        orchestrator = AIOrchestrator(gateway)
        
        # Execute
        response = await orchestrator.execute_request("user1", [{"role": "user", "content": "Write Python"}], task_type="programming")
        
        # Assert
        assert response == "Ollama code response"
        gateway.ollama.chat.assert_called_once()
        assert gateway.ollama.chat.await_args.kwargs['model'] == "qwen2.5-coder:7b"


def test_brain_adapter_maps_runtime_agent_names_to_capabilities():
    adapter = AIBrainAdapter.__new__(AIBrainAdapter)

    assert adapter._map_agent_to_capability("lesson_planner") == AgentCapability.LESSON_PLANNING
    assert adapter._map_agent_to_capability("tutor") == AgentCapability.TEACHING
    assert adapter._map_agent_to_capability("rag") == AgentCapability.KNOWLEDGE_RETRIEVAL
    assert adapter._map_agent_to_capability("analytics") == AgentCapability.ANALYTICS


@pytest.mark.asyncio
async def test_gateway_model_health_returns_provider_snapshot():
    gateway = AIGateway()
    gateway.gemini.is_enabled = lambda: True
    gateway.ollama._get_client = AsyncMock(return_value=object())
    gateway.ollama._headers = lambda: {}

    with patch.object(
        gateway.model_router,
        "health_snapshot",
        AsyncMock(return_value={"ollama_available": True, "models": []}),
    ) as health_snapshot:
        result = await gateway.model_health()

    assert result["ollama_available"] is True
    assert result["gemini_enabled"] is True
    assert result["ollama_base_url_configured"] is True
    health_snapshot.assert_awaited_once()
