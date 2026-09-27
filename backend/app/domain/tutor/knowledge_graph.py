"""Knowledge graph for concept dependencies and learning paths."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class KnowledgeGraph:
    """Lightweight knowledge graph for concept prerequisites and recommendations."""

    def __init__(self) -> None:
        self._concepts: dict[str, dict[str, Any]] = {
            "functions": {"prerequisites": [], "related": ["calculus", "algebra"], "difficulty": "beginner"},
            "linear_algebra": {"prerequisites": ["functions", "basic_mathematics"], "related": ["matrices", "calculus"], "difficulty": "intermediate"},
            "matrices": {"prerequisites": ["linear_algebra", "functions"], "related": ["neural_networks", "deep_learning"], "difficulty": "intermediate"},
            "calculus": {"prerequisites": ["functions", "algebra"], "related": ["neural_networks", "physics"], "difficulty": "intermediate"},
            "neural_networks": {"prerequisites": ["matrices", "calculus", "linear_algebra"], "related": ["deep_learning", "machine_learning"], "difficulty": "advanced"},
            "deep_learning": {"prerequisites": ["neural_networks", "python"], "related": ["computer_vision", "nlp"], "difficulty": "advanced"},
            "machine_learning": {"prerequisites": ["statistics", "python", "linear_algebra"], "related": ["deep_learning", "data_science"], "difficulty": "intermediate"},
            "statistics": {"prerequisites": ["basic_mathematics", "probability"], "related": ["machine_learning", "data_science"], "difficulty": "intermediate"},
            "probability": {"prerequisites": ["basic_mathematics"], "related": ["statistics", "machine_learning"], "difficulty": "intermediate"},
            "python": {"prerequisites": ["basic_mathematics"], "related": ["data_science", "web_development"], "difficulty": "beginner"},
            "basic_mathematics": {"prerequisites": [], "related": ["algebra", "geometry", "arithmetic"], "difficulty": "beginner"},
            "algebra": {"prerequisites": ["basic_mathematics"], "related": ["linear_algebra", "calculus"], "difficulty": "beginner"},
            "geometry": {"prerequisites": ["basic_mathematics"], "related": ["trigonometry", "physics"], "difficulty": "beginner"},
            "photosynthesis": {"prerequisites": ["cell_biology", "chemistry"], "related": ["plant_physiology", "ecology"], "difficulty": "beginner"},
            "cell_biology": {"prerequisites": ["basic_biology"], "related": ["photosynthesis", "genetics"], "difficulty": "beginner"},
            "basic_biology": {"prerequisites": [], "related": ["cell_biology", "ecology", "genetics"], "difficulty": "beginner"},
            "chemical_bonding": {"prerequisites": ["atomic_structure"], "related": ["organic_chemistry", "molecules"], "difficulty": "beginner"},
            "atomic_structure": {"prerequisites": [], "related": ["chemical_bonding", "periodic_table"], "difficulty": "beginner"},
            "data_structures": {"prerequisites": ["python", "basic_mathematics"], "related": ["algorithms", "competitive_programming"], "difficulty": "intermediate"},
            "algorithms": {"prerequisites": ["data_structures", "basic_mathematics"], "related": ["competitive_programming", "system_design"], "difficulty": "intermediate"},
            "system_design": {"prerequisites": ["algorithms", "networking"], "related": ["distributed_systems", "cloud_computing"], "difficulty": "advanced"},
            "networking": {"prerequisites": [], "related": ["system_design", "cybersecurity"], "difficulty": "intermediate"},
            "english_grammar": {"prerequisites": [], "related": ["writing", "communication"], "difficulty": "beginner"},
            "spoken_english": {"prerequisites": ["english_grammar"], "related": ["communication", "ielts"], "difficulty": "beginner"},
            "ielts": {"prerequisites": ["english_grammar", "spoken_english"], "related": ["toefl", "academic_writing"], "difficulty": "intermediate"},
        }

    def get_prerequisites(self, concept: str) -> list[str]:
        concept_data = self._concepts.get(concept.lower())
        if not concept_data:
            return []
        return list(concept_data.get("prerequisites", []))

    def get_related(self, concept: str) -> list[str]:
        concept_data = self._concepts.get(concept.lower())
        if not concept_data:
            return []
        return list(concept_data.get("related", []))

    def get_difficulty(self, concept: str) -> str:
        concept_data = self._concepts.get(concept.lower())
        if not concept_data:
            return "intermediate"
        return concept_data.get("difficulty", "intermediate")

    def validate_prerequisites(self, target_concept: str, completed_concepts: list[str]) -> list[str]:
        completed = set(c.lower() for c in completed_concepts)
        target = target_concept.lower()
        missing: list[str] = []

        def _collect(concept: str) -> None:
            concept_data = self._concepts.get(concept)
            if not concept_data:
                return
            for prereq in concept_data.get("prerequisites", []):
                if prereq not in completed:
                    missing.append(prereq)
                _collect(prereq)

        _collect(target)
        return missing

    def build_learning_path(self, target_concept: str, completed_concepts: list[str]) -> list[str]:
        missing = self.validate_prerequisites(target_concept, completed_concepts)
        return missing + [target_concept.lower()]

    def recommend_next(self, current_concept: str, completed_concepts: list[str]) -> list[str]:
        related = self.get_related(current_concept)
        completed = set(c.lower() for c in completed_concepts)
        return [r for r in related if r not in completed][:5]

    def add_concept(self, concept: str, prerequisites: list[str], related: list[str], difficulty: str) -> None:
        self._concepts[concept.lower()] = {
            "prerequisites": prerequisites,
            "related": related,
            "difficulty": difficulty,
        }

    def describe_concept(self, concept: str) -> str:
        concept_data = self._concepts.get(concept.lower())
        if not concept_data:
            return ""
        parts = []
        if concept_data.get("prerequisites"):
            parts.append(f"Prerequisites: {', '.join(concept_data['prerequisites'])}")
        if concept_data.get("related"):
            parts.append(f"Related: {', '.join(concept_data['related'])}")
        parts.append(f"Difficulty: {concept_data.get('difficulty', 'intermediate')}")
        return ". ".join(parts)

    def learning_path(self, topic: str) -> list[str]:
        normalized = topic.lower()
        prerequisites = self.get_prerequisites(normalized)
        return [*prerequisites, normalized] if prerequisites else [normalized]

    def get_all_concepts(self) -> list[str]:
        return list(self._concepts.keys())
