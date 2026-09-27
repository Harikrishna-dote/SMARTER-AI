from __future__ import annotations

import asyncio
import logging
import math
from typing import Any, Callable
from uuid import NAMESPACE_URL, uuid5

from app.core.config import Settings

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qdrant_models
except ImportError:  # pragma: no cover - optional vector search dependency
    QdrantClient = None  # type: ignore[assignment]
    qdrant_models = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


class VectorService:
    """Optional Qdrant-powered vector search for retrieval augmentation."""

    def __init__(self, settings: Settings, embed_fn: Callable[[str], Any] | None = None):
        self.settings = settings
        self.embed_fn = embed_fn
        self.collection = settings.qdrant_collection
        self.client = None
        self._memory_points: dict[str, dict[str, Any]] = {}
        self._collection_lock = asyncio.Lock()
        if QdrantClient is not None and settings.qdrant_url:
            try:
                self.client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)
            except Exception as exc:
                logger.warning("Could not connect to Qdrant at %s: %s", settings.qdrant_url, exc)
                self.client = None

    @property
    def available(self) -> bool:
        # Embeddings plus the local index are enough for development and tests;
        # Qdrant is an optional acceleration and persistence layer.
        return self.embed_fn is not None

    async def index_document(
        self,
        document_id: str,
        text: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        if not self.available:
            return
        if not text.strip():
            return
        metadata = metadata or {}
        vector = await self._embed(text)
        if not vector:
            return
        await self._ensure_collection(len(vector))
        point_id = self._point_id(document_id, metadata)
        payload = {"text": text, **metadata}
        self._memory_points[point_id] = {"id": point_id, "vector": vector, "payload": payload}
        await asyncio.to_thread(self._upsert, point_id, vector, payload)

    async def search(
        self,
        query: str,
        limit: int = 4,
        user_id: str | None = None,
    ) -> list[dict[str, Any]]:
        if not self.available:
            return []
        embedding = await self._embed(query)
        if not embedding:
            return []
        await self._ensure_collection(len(embedding))
        results = await asyncio.to_thread(self._search, embedding, limit, user_id)
        if results or self.client is None:
            return results
        # A transient Qdrant failure should not make local development unusable.
        return self._search_memory(embedding, limit, user_id)

    async def delete_document(self, document_id: str) -> None:
        """Remove all indexed chunks for a document from local and remote stores."""
        matching_ids = [
            point_id
            for point_id, point in self._memory_points.items()
            if point.get("payload", {}).get("document_id") == document_id
        ]
        for point_id in matching_ids:
            self._memory_points.pop(point_id, None)
        if self.client is None or qdrant_models is None or not matching_ids:
            return
        try:
            await asyncio.to_thread(
                self.client.delete,
                collection_name=self.collection,
                points_selector=qdrant_models.PointIdsList(points=matching_ids),
            )
        except Exception as exc:
            logger.warning("Qdrant delete failed for document '%s': %s", document_id, exc)

    async def _embed(self, text: str) -> list[float]:
        if self.embed_fn is None:
            return []
        result = self.embed_fn(text)
        if hasattr(result, "__await__"):
            result = await result
        try:
            return [float(value) for value in result]
        except (TypeError, ValueError):
            logger.warning("Embedding provider returned an invalid vector")
            return []

    @staticmethod
    def _point_id(document_id: str, metadata: dict[str, Any]) -> str:
        chunk_index = metadata.get("chunk_index")
        suffix = f":{chunk_index}" if chunk_index is not None else ""
        return str(uuid5(NAMESPACE_URL, f"smarter-ai:{document_id}{suffix}"))

    async def _ensure_collection(self, vector_size: int) -> None:
        if self.client is None or qdrant_models is None:
            return

        async with self._collection_lock:
            try:
                existing = await asyncio.to_thread(self.client.get_collection, self.collection)
                if existing is not None:
                    return
            except Exception:
                pass

            try:
                await asyncio.to_thread(
                    self.client.create_collection,
                    collection_name=self.collection,
                    vectors=qdrant_models.VectorParams(size=vector_size, distance=qdrant_models.Distance.COSINE),
                )
            except Exception as exc:
                logger.warning("Failed to create Qdrant collection '%s': %s", self.collection, exc)

    def _upsert(self, point_id: str, vector: list[float], payload: dict[str, Any]) -> None:
        if self.client is None or qdrant_models is None:
            return
        try:
            self.client.upsert(
                collection_name=self.collection,
                points=[
                    qdrant_models.PointStruct(id=point_id, vector=vector, payload=payload),
                ],
            )
        except Exception as exc:
            logger.warning("Qdrant upsert failed: %s", exc)

    def _search(
        self,
        query_vector: list[float],
        limit: int,
        user_id: str | None = None,
    ) -> list[dict[str, Any]]:
        if self.client is None or qdrant_models is None:
            return self._search_memory(query_vector, limit, user_id)
        try:
            query_filter = None
            if user_id:
                query_filter = qdrant_models.Filter(
                    must=[
                        qdrant_models.FieldCondition(
                            key="user_id",
                            match=qdrant_models.MatchValue(value=user_id),
                        )
                    ]
                )
            if hasattr(self.client, "query_points"):
                response = self.client.query_points(
                    collection_name=self.collection,
                    query=query_vector,
                    query_filter=query_filter,
                    limit=max(1, min(limit, 20)),
                    with_payload=True,
                )
                hits = getattr(response, "points", response)
            else:
                hits = self.client.search(
                    collection_name=self.collection,
                    query_vector=query_vector,
                    query_filter=query_filter,
                    limit=max(1, min(limit, 20)),
                    with_payload=True,
                )
            results: list[dict[str, Any]] = []
            for hit in hits:
                payload = getattr(hit, "payload", {}) or {}
                results.append(
                    {
                        "id": hit.id,
                        "score": getattr(hit, "score", None),
                        "payload": payload,
                        "text": payload.get("text", ""),
                        "source": payload.get("source") or payload.get("filename", "vector"),
                    }
                )
            return results
        except Exception as exc:
            logger.warning("Qdrant search failed: %s", exc)
            return []

    def _search_memory(
        self,
        query_vector: list[float],
        limit: int,
        user_id: str | None = None,
    ) -> list[dict[str, Any]]:
        scored: list[tuple[float, dict[str, Any]]] = []
        for point in self._memory_points.values():
            payload = point.get("payload", {})
            if user_id and payload.get("user_id") != user_id:
                continue
            score = self._cosine_similarity(query_vector, point.get("vector", []))
            scored.append(
                (
                    score,
                    {
                        "id": point.get("id"),
                        "score": score,
                        "payload": payload,
                        "text": payload.get("text", ""),
                        "source": payload.get("source") or payload.get("filename", "vector"),
                    },
                )
            )
        scored.sort(key=lambda item: item[0], reverse=True)
        return [item[1] for item in scored[: max(1, min(limit, 20))]]

    @staticmethod
    def _cosine_similarity(first: list[float], second: list[float]) -> float:
        if not first or not second or len(first) != len(second):
            return 0.0
        numerator = sum(left * right for left, right in zip(first, second))
        first_norm = math.sqrt(sum(value * value for value in first))
        second_norm = math.sqrt(sum(value * value for value in second))
        if not first_norm or not second_norm:
            return 0.0
        return numerator / (first_norm * second_norm)
