# System Diagram

```mermaid
flowchart LR
  UI[React + Redux UI] --> API[FastAPI]
  API --> PG[(PostgreSQL)]
  API --> OLLAMA[Ollama / Qwen3]
  API --> DOCS[Document Store]
  API --> VISION[OCR / Vision]
  API --> VOICE[STT / TTS]
  OLLAMA --> AGENTS[Agent Framework]
  DOCS --> RAG[RAG Retriever]
```

