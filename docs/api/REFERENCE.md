# SMARTER-AI API Documentation

## Classroom API
- `POST /api/v1/classroom/lesson`: Generate structured lesson plan.
- `POST /api/v1/classroom/quiz`: Generate adaptive quiz.
- `POST /api/v1/classroom/homework`: Generate personalized homework.
- `GET /api/v1/classroom/progress`: Retrieve student mastery analytics.

## Voice API
- `POST /api/v1/voice/synthesize`: Convert text to audio (wav).
- `POST /api/v1/voice/synthesize/stream`: Stream synthesized audio as a WAV response.
- `POST /api/v1/voice/transcribe`: Convert uploaded audio to text and detect the spoken language.
- `POST /api/v1/voice/transcribe/stream`: Stream incremental speech recognition events as NDJSON.
