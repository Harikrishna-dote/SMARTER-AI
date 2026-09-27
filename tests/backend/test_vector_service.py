from types import SimpleNamespace

import pytest

from app.application.ai_brain.rag import RAGPipeline
from app.services.vector_service import VectorService


def _settings():
    return SimpleNamespace(
        qdrant_collection="test-documents",
        qdrant_url="",
        qdrant_api_key="",
    )


def _embed(text: str) -> list[float]:
    lowered = text.lower()
    if "alpha" in lowered or "first" in lowered:
        return [1.0, 0.0]
    return [0.0, 1.0]


@pytest.mark.asyncio
async def test_vector_service_keeps_document_chunks_and_scopes_local_search():
    service = VectorService(_settings(), embed_fn=_embed)

    await service.index_document(
        "document-1",
        "first chunk about alpha",
        {"document_id": "document-1", "chunk_index": 0, "user_id": "student-1", "filename": "notes.md"},
    )
    await service.index_document(
        "document-1",
        "second chunk about beta",
        {"document_id": "document-1", "chunk_index": 1, "user_id": "student-1", "filename": "notes.md"},
    )
    await service.index_document(
        "document-2",
        "first chunk about alpha",
        {"document_id": "document-2", "chunk_index": 0, "user_id": "student-2", "filename": "other.md"},
    )

    results = await service.search("alpha", user_id="student-1")

    assert len(service._memory_points) == 3
    assert results
    assert results[0]["text"] == "first chunk about alpha"
    assert results[0]["payload"]["filename"] == "notes.md"
    assert all(result["payload"]["user_id"] == "student-1" for result in results)


@pytest.mark.asyncio
async def test_rag_pipeline_exposes_normalized_text_and_citations():
    class FakeVectorService:
        async def search(self, query: str, limit: int):
            return [{
                "id": "chunk-1",
                "score": 0.91,
                "payload": {"text": "Photosynthesis converts light into chemical energy.", "filename": "biology.md"},
            }]

    pipeline = RAGPipeline(vector_service=FakeVectorService())

    result = await pipeline.retrieve("photosynthesis", {"max_sources": 3})

    assert result["sources"][0]["content"].startswith("Photosynthesis")
    assert result["sources"][0]["source"] == "biology.md"
    assert result["sources"][0]["citation"]["id"] == "chunk-1"
