"""Unified RAG pipeline for the AI Brain."""

from __future__ import annotations

from typing import Any

from app.domain.ai_brain import AgentCapability, ExecutionStep


class RAGPipeline:
    """Enterprise RAG pipeline combining vector search, knowledge graph, and document retrieval."""

    def __init__(
        self,
        vector_service: Any | None = None,
        knowledge_graph: Any | None = None,
        source_service: Any | None = None,
        document_service: Any | None = None,
    ) -> None:
        self.vector_service = vector_service
        self.knowledge_graph = knowledge_graph
        self.source_service = source_service
        self.document_service = document_service

    async def retrieve(self, query: str, context: dict[str, Any]) -> dict[str, Any]:
        sources: list[dict[str, Any]] = []
        max_sources = max(1, min(int(context.get("max_sources", 5)), 20))
        user_id = context.get("user_id")

        if self.vector_service and hasattr(self.vector_service, "search"):
            try:
                if user_id:
                    results = await self.vector_service.search(query, limit=max_sources, user_id=user_id)
                else:
                    results = await self.vector_service.search(query, limit=max_sources)
                for result in results:
                    payload = result.get("payload", {}) or {}
                    sources.append({
                        "type": "vector",
                        "content": result.get("text") or payload.get("text", ""),
                        "score": result.get("score", 0.0),
                        "source": result.get("source") or payload.get("filename", "vector"),
                        "citation": {
                            "id": result.get("id"),
                            "source": result.get("source") or payload.get("filename", "vector"),
                            "chunk_index": payload.get("chunk_index"),
                        },
                    })
            except Exception:
                pass

        if self.knowledge_graph:
            try:
                kg_results = self.knowledge_graph.get_prerequisites(query)
                if kg_results:
                    sources.append({
                        "type": "knowledge_graph",
                        "content": str(kg_results),
                        "score": 0.8,
                        "source": "knowledge_graph",
                    })
            except Exception:
                pass

        if self.source_service:
            try:
                url_context = await self.source_service.extract_url_context(query)
                if url_context:
                    sources.append({
                        "type": "web",
                        "content": url_context.get("text") or url_context.get("summary", ""),
                        "score": 0.7,
                        "source": url_context.get("source_url", "web"),
                        "citation": {
                            "source": url_context.get("source_url", "web"),
                            "title": url_context.get("name", ""),
                        },
                    })
            except Exception:
                pass

        sources.sort(key=lambda x: x.get("score", 0.0), reverse=True)
        return {
            "query": query,
            "sources": sources[:max_sources],
            "total_sources": len(sources),
        }

    async def augment(self, query: str, retrieved: dict[str, Any]) -> str:
        parts: list[str] = []
        parts.append(f"Query: {query}")
        for idx, source in enumerate(retrieved.get("sources", []), 1):
            content = source.get("content", "")
            if content:
                parts.append(f"[Source {idx}] {content[:1000]}")
        return "\n\n".join(parts)

    async def execute(self, step: ExecutionStep, context: dict[str, Any]) -> dict[str, Any]:
        query = step.input.get("query", "")
        retrieved = await self.retrieve(query, context)
        augmented = await self.augment(query, retrieved)
        return {
            "retrieved": retrieved,
            "augmented_prompt": augmented,
            "sources_used": len(retrieved.get("sources", [])),
        }
