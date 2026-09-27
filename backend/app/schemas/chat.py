from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    title: str = Field(default="New conversation", max_length=180)


class ConversationRead(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageRead(BaseModel):
    id: str
    role: str
    content: str
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TutorProfile(BaseModel):
    subject: str = Field(default="General", min_length=1, max_length=80)
    level: str = Field(default="Adaptive", min_length=1, max_length=80)
    teaching_mode: Literal["explain", "solve", "practice", "quiz", "revise", "translate"] = "explain"
    language: str = Field(default="English", min_length=1, max_length=80)
    response_style: Literal["friendly", "concise", "step_by_step", "exam_ready"] = "friendly"
    response_speed: Literal["instant", "balanced", "deep"] = "instant"


class ChatAttachment(BaseModel):
    type: Literal["image", "video", "document", "web", "audio", "note"] = "note"
    name: str = Field(default="Context", max_length=180)
    content_type: str | None = Field(default=None, max_length=120)
    text: str = Field(default="", max_length=20000)
    summary: str | None = Field(default=None, max_length=4000)
    source_url: str | None = Field(default=None, max_length=2048)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    use_memory: bool = True
    document_id: str | None = None
    tutor: TutorProfile = Field(default_factory=TutorProfile)
    attachments: list[ChatAttachment] = Field(default_factory=list, max_length=8)
    voice_response: bool = False


class ChatResponse(BaseModel):
    conversation_id: str
    message: MessageRead

