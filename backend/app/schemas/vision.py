from pydantic import BaseModel, Field


class ImageAnalysisResponse(BaseModel):
    description: str
    text: str | None = None


class OCRResponse(BaseModel):
    text: str


class MediaContextResponse(BaseModel):
    type: str
    name: str
    content_type: str
    text: str = ""
    summary: str = ""
    processing_notes: list[str] = Field(default_factory=list)
