import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SMARTER AI"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "sqlite+aiosqlite:///./future.db"
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
    ollama_base_url: str = "http://localhost:11434"
    ollama_api_key: str = ""

    # Defined priority chains: [primary_model, fallback_1, fallback_2, ...]
    # Primary can be 'gemini-2.5-flash', 'ollama:model_name', etc.
    model_fallback_chains: dict[str, list[str]] = Field(default_factory=lambda: {
        "general": ["gemini-2.5-flash", "ollama:smarter-qwen3:4b", "ollama:qwen3:4b"],
        "chat": ["gemini-2.5-flash", "ollama:smarter-qwen3:4b", "ollama:gemma3:4b"],
        "tutor": ["gemini-2.5-flash", "ollama:smarter-qwen3:4b", "ollama:aya-expanse:8b"],
        "coding": ["gemini-2.5-flash", "ollama:qwen2.5-coder:7b", "ollama:smarter-qwen3:4b"],
        "translation": ["gemini-2.5-flash", "ollama:aya-expanse:8b", "ollama:smarter-qwen3:4b"],
        "embeddings": ["ollama:nomic-embed-text:latest"],
    })

    # Deprecated fields (will be mapped to model_fallback_chains in the orchestrator)
    ollama_model: str = "smarter-qwen3:4b"
    ollama_fast_model: str = "gemma3:1b"
    ollama_quality_model: str = "smarter-qwen3:4b"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    ollama_coder_model: str = "qwen2.5-coder:7b"
    ollama_translation_model: str = "aya-expanse:8b"
    ollama_embedding_model: str = "nomic-embed-text:latest"
    ollama_context_window: int = 32768
    translation_context_window: int = 32768
    instant_context_window: int = 16384
    ollama_max_output_tokens: int = 8192
    instant_max_output_tokens: int = 4096
    instant_chat_history_messages: int = 50
    max_chat_history_messages: int = 200
    max_context_chars: int = 50000
    ai_request_timeout_seconds: int = 180
    translation_request_timeout_seconds: int = 120
    ollama_thinking: bool = False
    ollama_keep_alive: str = "5m"
    model_router_enabled: bool = True
    model_router_registry: dict[str, dict] = Field(default_factory=dict)
    model_router_fallbacks: dict[str, list[str] | str] = Field(default_factory=dict)
    model_health_cache_ttl_seconds: int = 30
    model_unhealthy_cooldown_seconds: int = 60
    ollama_release_idle_models: bool = False
    ollama_idle_model_ttl_seconds: int = 600
    redis_url: str = "redis://localhost:6379/0"
    web_context_timeout_seconds: int = 30
    gzip_minimum_size: int = 500
    voice_enabled: bool = True
    voice_temp_dir: str = "temp_audio"
    voice_stt_model_name: str = "models/faster-whisper-medium"
    voice_stt_device: str = "auto"
    voice_tts_provider: str = "piper"
    piper_model_path: str = "models/te/te_IN/padmavathi/medium/te_IN-padmavathi-medium.onnx"
    piper_config_path: str = "models/te/te_IN/padmavathi/medium/te_IN-padmavathi-medium.onnx.json"
    piper_model_path_en: str = "models/en/en_US/ryan/medium/en_US-ryan-medium.onnx"
    piper_config_path_en: str = "models/en/en_US/ryan/medium/en_US-ryan-medium.onnx.json"
    parler_tts_model: str = "ai4bharat/indic-parler-tts-pretrained"
    voice_default_language: str = "auto"
    voice_supported_languages: list[str] = Field(default_factory=lambda: ["en", "te"])
    voice_tts_cache_enabled: bool = True
    voice_tts_cache_ttl: int = 3600
    voice_streaming_enabled: bool = True
    voice_lesson_sync_enabled: bool = True
    allowed_hosts: list[str] = Field(default_factory=list)
    feature_flags: dict[str, bool] = Field(default_factory=dict)
    auto_create_tables: bool = True
    plugins_directory: str = "app/plugins/installed"
    upload_dir: str = "documents/uploads"
    extracted_dir: str = "documents/extracted"
    retire_default_admin_account: bool = False
    retired_admin_email: str = "admin@example.com"

    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_collection: str = "smarter_ai_documents"

    create_default_admin: bool = False
    default_admin_email: str = Field(default="admin@smarter-ai.app")
    default_admin_password: str = Field(min_length=8)
    default_admin_name: str = "Platform Admin"

    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60
    max_upload_size_mb: int = 50
    allowed_upload_types: list[str] = Field(default_factory=lambda: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "image/jpeg",
        "image/png",
        "image/webp",
        "text/plain",
        "text/markdown",
    ])

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[3] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def resolve_database_path(self) -> "Settings":
        db_url = self.database_url
        if db_url.startswith("sqlite"):
            path = db_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
            if not Path(path).is_absolute():
                project_root = Path(__file__).resolve().parents[3]
                resolved = project_root / path
                self.database_url = f"sqlite+aiosqlite:///{resolved}"
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
