# SMARTTER-AI Architecture

SMARTTER-AI is moving toward a clean, modular enterprise architecture while
preserving working classroom, chat, translation, voice, vision, document, and
memory features.

## Runtime Boundaries

- Frontend: React + TypeScript feature modules, shared UI primitives, route-level lazy loading, and API services.
- Backend API: FastAPI routers that validate HTTP contracts and delegate business behavior.
- Application layer: use cases that coordinate domain policy, repositories, gateways, and external services.
- Domain layer: framework-free tutor, learning, memory, assessment, and recommendation policies.
- Infrastructure layer: database, Redis cache, vector search, model gateways, document storage, workers, and observability.

## Backend Dependency Rule

Dependencies must point inward:

`api -> application -> domain`

`repositories/services/gateways -> application/domain`

The domain layer must not import FastAPI, SQLAlchemy sessions, HTTP clients, or provider SDKs.

## AI Tutor Flow

The autonomous tutor is coordinated through `app.application.tutor_orchestrator.AITutorOrchestrator`.
It owns lesson planning, prerequisite checks, teaching strategy selection, AI prompt policy, and deterministic fallbacks.
Feature services such as `ClassroomService` call the orchestrator instead of embedding tutor policy directly.

## Data Stores

- PostgreSQL: durable users, conversations, lessons, progress, documents, analytics, and audit records.
- Redis: short-lived response caches, classroom session state, rate limits, and background task metadata.
- Qdrant/vector store: semantic memory, document retrieval, concept embeddings, and learning graph search.

## Migration Rules

- Preserve existing endpoints unless an API version migration is documented.
- Move business policy out of route handlers first, then out of broad services.
- Prefer small use-case modules over large cross-feature services.
- Add tests around boundaries before deleting duplicate or obsolete code.
- Treat Telugu/bilingual voice, plan-first tutoring, consent, doubt checks, and understanding gates as classroom acceptance criteria.
