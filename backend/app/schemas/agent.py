from datetime import datetime

from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = ""
    system_prompt: str = Field(min_length=5)
    tools: list[str] = []
    is_public: bool = False


class AgentRead(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: str
    tools: list
    is_public: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentRunRequest(BaseModel):
    task: str = Field(min_length=1)


class AgentRunResponse(BaseModel):
    output: str
    tool_calls: list[dict] = []

