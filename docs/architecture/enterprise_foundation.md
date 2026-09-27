# SMARTTER-AI Enterprise Foundation

This document defines the architecture foundation for future implementation phases.
It is a migration target, not a request to rewrite working functionality in one pass.

## Target Repository Layout

- `frontend/src/app`: routing, providers, app shell composition.
- `frontend/src/features`: feature modules such as classroom, chat, translator, voice, vision, documents, analytics, and admin.
- `frontend/src/components`: reusable UI primitives and cross-feature components.
- `frontend/src/services`: API clients, streaming clients, telemetry clients, and browser capability adapters.
- `backend/app/api`: thin FastAPI routers and request/response contracts.
- `backend/app/application`: use cases and orchestration workflows.
- `backend/app/domain`: framework-free business rules, entities, value objects, and policies.
- `backend/app/repositories`: persistence abstractions and SQL-backed implementations.
- `backend/app/services`: infrastructure adapters retained during migration.
- `backend/app/workers`: background jobs for documents, voice, analytics, and long-running AI tasks.
- `backend/app/observability`: logging, metrics, tracing, and health probes.
- `database`: migrations, seeds, schema docs, indexes, and vector-store setup.
- `deployment`: Docker, Compose, CI, reverse proxy, monitoring, and production runbooks.

## AI Orchestration Contract

Every AI feature should flow through an application-level orchestrator before reaching a model provider.
The orchestrator is responsible for:

- model selection and fallback;
- streaming and non-streaming response policy;
- tool-use eligibility;
- memory and retrieval context assembly;
- lesson state transitions;
- language and voice policy;
- graceful degradation when providers fail.

The first implemented orchestrator is `AITutorOrchestrator`, which centralizes lesson planning for classroom lessons.

## Human Conversation, Voice, and Avatar

The classroom experience separates natural interaction concerns into explicit layers:

- Conversation intelligence estimates language and learner signals such as confusion, confidence, curiosity, frustration, boredom, excitement, and fatigue.
- Voice control supports browser speech recognition/synthesis with multilingual fallback, captions, replay/pause behavior, push-to-talk, and hands-free mode.
- Avatar rendering consumes classroom state and conversation signals; it should never contain lesson business logic.
- Tutor prompts receive adaptive conversation instructions so interruptions can be answered first and the current lesson can resume without restarting.

Advanced speech-to-speech providers, phoneme-level lip sync, voice activity detection, and noise suppression should be added behind adapter interfaces instead of hard-coding a provider into classroom components.

## Dynamic Visual Learning Engine

Visual learning is split into decision, rendering, and controls:

- Visual decision: `frontend/src/features/classroom/visualLearningEngine.ts` selects a visual mode from topic, concept, learner level, and learning mode.
- Rendering: the current classroom canvas consumes `VisualScriptItem[]` commands and remains replaceable by SVG, Lottie, Three.js, or WebGL adapters.
- AI enrichment: backend lesson generation asks the tutor orchestrator for simple 800x600 canvas-safe visual scripts, but the frontend always has deterministic fallback scenes.
- Interactivity: classroom controls expose pause/play, replay, next stage, animation speed, label visibility, and reduced-motion behavior.
- Accessibility: every scene includes a static fallback description and should preserve captions/text explanations before visuals.

Future 3D, AR/VR, collaborative whiteboard, and educational game engines should be added as new render adapters behind the visual decision contract, not embedded directly in page components.

## Memory, RAG, and Learning Intelligence

Memory is split into deterministic layers before adding external vector infrastructure:

- Domain policy: `backend/app/domain/memory/learning_memory.py` defines session, conversation, learning, preference, knowledge, and vector memory layers.
- Application orchestration: `backend/app/application/memory_engine.py` formats retrieved context, stages tutor preferences, records concept mastery, and adds knowledge graph notes.
- Current storage: existing `memory_items` remains the durable store for this phase; layer prefixes such as `learning:*`, `preference:*`, and `knowledge:*` avoid migrations while preserving compatibility.
- Chat RAG: chat prompt preparation now injects retrieved learning intelligence when memory is enabled and stores only durable conversation signals.
- Document intelligence: uploaded documents create knowledge-memory index entries for search and future vector indexing.
- Privacy control: users can list, create, and delete individual memories.

Future Qdrant/Postgres-vector work should implement the vector memory layer behind the same `MemoryEngine` contract. The tutor must use retrieved context for personalization while clearly treating it as stored user/course context, not model retraining.

## Translation and Language Learning Engine

Translation is treated as a teaching workflow, not a text-only utility:

- Domain policy: `backend/app/domain/language_learning/learning_plan.py` classifies selected content as word, sentence, paragraph, or document and builds deterministic vocabulary, grammar, pronunciation, practice, and storage guidance.
- Application use case: `backend/app/application/language_learning_engine.py` converts domain plans into API-safe responses for translator, OCR, document, camera, and screen-selection workflows.
- API contract: `POST /translation/learning-plan` gives clients a lightweight educational plan that can be combined with existing translation, OCR, explain, flashcard, quiz, vocabulary, history, bookmark, and favorite endpoints.
- Privacy policy: learning-plan responses state whether content was stored; content is not personalized unless the user explicitly saves vocabulary or review material.
- Future adapters: real-time camera OCR, voice translation, document intelligence, pronunciation scoring, subtitle translation, and website translation should call the same learning-plan use case before provider-specific OCR, STT, TTS, or document parsing.

## Assessment, Labs, Career, and Analytics

Assessment is separated from lesson delivery so the tutor can verify mastery after teaching:

- Domain policy: `backend/app/domain/assessment/assessment_policy.py` estimates mastery, chooses adaptive difficulty, and creates plans for quizzes, exams, homework, projects, coding labs, virtual labs, career preparation, and skill assessment.
- Application use case: `backend/app/application/assessment_engine.py` maps deterministic plans into API responses without depending on model availability.
- API contract: `POST /assessment/plan` returns timing, section structure, question types, practice mix, rubrics, accessibility requirements, security notes, analytics signals, XP reward, and next steps.
- Existing compatibility: current classroom quiz, homework, evaluation, and progress routes remain intact; future AI generation should consume the assessment plan before calling `ClassroomService` or provider-backed exam generators.
- Future adapters: code execution sandboxes, exam attempt storage, project repositories, virtual science simulators, interview simulators, teacher dashboards, and analytics warehouses should attach behind this use case instead of embedding policy in UI components.

## Next-Generation UI/UX and Design System

The frontend design system is treated as an experience policy layer, not scattered page styling:

- Design policy: `frontend/src/features/ui/experiencePolicy.ts` centralizes typography, spacing, radius, elevation, color roles, motion rules, classroom layout decisions, dashboard widget order, and onboarding steps.
- Classroom layout: responsive plans resolve to mobile stacked, tablet split, desktop three-panel, or immersive wide classroom modes with roadmap, tutor stage, visualization lab, and sticky bottom controls.
- Accessibility: UI policy and CSS hooks support reduced motion, high contrast, large text, visible focus states, captions, keyboard navigation, and 48px touch targets.
- Performance: classroom plans require streaming tutor text before visuals, lazy-loading visualization adapters, virtualized long lists, CSS-transform motion, and deferred dashboard widgets.
- Future-ready UI: AR/VR rooms, multi-student sessions, teacher collaboration, enterprise dashboards, and advanced whiteboard tools should be added as adapters to the same layout policy instead of hard-coding new page layouts.

## Production, Security, and Observability

Operational readiness is now represented as a deterministic policy instead of scattered deployment notes:

- Domain policy: `backend/app/domain/operations/production_readiness.py` evaluates security, performance, observability, scalability, API versioning, and feature-flag readiness without exposing secret values.
- Application use case: `backend/app/application/operations_engine.py` maps readiness controls into API-safe responses for smoke tests, dashboards, and deployment gates.
- API contract: `GET /ready` returns a compact deployment probe, while `GET /api/v1/operations/readiness` returns detailed non-secret readiness controls.
- Cache safety: backend cache middleware now public-caches only health/readiness probes and marks other GET responses `no-store` to avoid leaking authenticated API data through shared caches.
- Logging: startup logging is environment-aware and uses a stable key-value format for centralized log ingestion.
- Future adapters: database ping checks, Redis/Qdrant health checks, OpenTelemetry traces, Celery worker monitoring, backup verification, load-test reports, and CI/CD gates should feed the same readiness model.

## Tutor Domain Policy

The domain tutor package defines the stable lesson sequence:

1. greeting
2. learning objective
3. prior-knowledge assessment
4. personalized plan
5. topic introduction
6. concept explanation
7. visual demonstration
8. real-life example
9. interactive discussion
10. guided practice
11. mini quiz
12. mistake analysis
13. homework
14. notes
15. summary
16. recommendation
17. next lesson

Domain policy stays deterministic and testable. LLM calls may enrich content, but they must not be the only source of valid behavior.

## Production Readiness Priorities

- Stabilize API contracts and streaming behavior.
- Move classroom, chat, memory, and assessment logic into application use cases.
- Add PostgreSQL migrations for lesson state, learning memory, analytics events, and audit logs.
- Add Redis-backed rate limiting and temporary session state.
- Add vector memory adapters behind repository interfaces.
- Add structured logging and health checks for AI providers, database, Redis, and workers.
- Add unit, integration, frontend, e2e, accessibility, and performance checks to CI.
- Add provider-backed streaming STT/TTS and phoneme timing once the adapter contracts are stable.
