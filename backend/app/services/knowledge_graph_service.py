from pathlib import Path
from typing import List

from app.domain.tutor.knowledge_graph import KnowledgeGraph


class KnowledgeGraphService:
    def __init__(self):
        self._domain_graph = KnowledgeGraph()

    def get_prerequisites(self, topic: str) -> List[str]:
        return self._domain_graph.get_prerequisites(topic)

    def describe_concept(self, topic: str) -> str:
        return self._domain_graph.describe_concept(topic)

    def learning_path(self, topic: str) -> List[str]:
        return self._domain_graph.learning_path(topic)

    def validate_prerequisites(self, topic: str, completed_topics: List[str]) -> List[str]:
        return self._domain_graph.validate_prerequisites(topic, completed_topics)
