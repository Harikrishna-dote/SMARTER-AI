from datetime import datetime

from pydantic import BaseModel, Field


class MemoryCreate(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1)
    source: str = "manual"


class MemoryRead(BaseModel):
    id: str
    key: str
    value: str
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}

