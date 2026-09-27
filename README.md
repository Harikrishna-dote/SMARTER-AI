# SMARTER AI

SMARTER AI is a self-hosted multimodal tutor built with free and open-source technology. It teaches across subjects, adapts by level, uses documents/images/videos/web sources as context, and keeps user-controlled learning memory.

## Stack

- Frontend: React, TypeScript, TailwindCSS, Vite, Redux Toolkit, React Router
- Backend: FastAPI, PostgreSQL, JWT auth, REST APIs, WebSockets
- AI: Ollama, Qwen3 tutoring, Gemma 3 translation, local memory, RAG, agents, tool calling
- Documents and vision: PDF/DOCX/text extraction, image OCR through Tesseract, optional video frame OCR through OpenCV
- Voice: browser speech recognition and speech synthesis, plus local adapter hooks for Whisper/faster-whisper and Piper TTS

## Quick Start

1. Copy `.env.example` to `.env` and change `JWT_SECRET`.
2. Start the platform:

```bash
docker compose up --build
```

3. Pull the local model:

```bash
docker compose exec ollama ollama pull qwen3:4b
docker compose exec ollama ollama pull gemma3:4b
docker compose exec ollama ollama pull nomic-embed-text
docker compose cp ai-engine/models/SmarterQwen3.Modelfile ollama:/tmp/SmarterQwen3.Modelfile
docker compose exec ollama ollama create smarter-qwen3:4b -f /tmp/SmarterQwen3.Modelfile
```

4. Open:

- Frontend: `http://localhost:5173`
- Backend docs: `http://localhost:8000/docs`
- Nginx gateway: `http://localhost:8080`

## Development

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

Local development uses `backend/future.db` (SQLite), so PostgreSQL is not required. A default platform admin is provisioned automatically on backend startup (see `CREATE_DEFAULT_ADMIN` in `.env`):

- Email: `admin@smarter-ai.app`
- Password: `Smarter@Admin123`

Change these via `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` in `.env`. The account is created only if it does not already exist and uses a distinct email from the legacy `admin@example.com` account that is retired in development. The admin can manage the platform from the **Admin** link in the sidebar (visible only to admins) and monitor classroom usage.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```text
frontend/        React application
backend/         FastAPI application
ai-engine/       Ollama, RAG, memory, agents, tools
vector-db/       Chroma and FAISS persistence locations
documents/       Uploads and extracted document text
backend/app/services/voice_service.py    Local STT, TTS, and multilingual voice orchestration
vision-system/   OCR, object detection, captioning, face adapters
database/        PostgreSQL schema, migrations, seeds, backups
deployment/      Docker, nginx, scripts, monitoring
tests/           Frontend, backend, AI, integration tests
docs/            Architecture, API, database, diagrams
```

## Notes

SMARTER AI does not call paid APIs. All model inference is routed to Ollama and can run locally with open-source models.
The public home chat works without an account and reports a clear offline state until Ollama and the configured model are running.

For image OCR, install Tesseract and make sure it is available on `PATH`. Video frame OCR is included in the backend dependencies through OpenCV. For a manual install:

```bash
pip install opencv-python-headless
```
