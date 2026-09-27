from datetime import datetime

from pydantic import BaseModel


class DocumentRead(BaseModel):
    id: str
    filename: str
    content_type: str
    extracted_text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentChatRequest(BaseModel):
    question: str


class DocumentChatResponse(BaseModel):
    answer: str
    document_id: str

