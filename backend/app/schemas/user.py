from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr


class UserRead(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    is_active: bool
    is_admin: bool
    role: str
    xp: int
    level: int
    streak: int
    last_active_date: str | None
    career_goals: list[Any]
    skills: list[Any]
    interests: list[Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    conversations: int
    memories: int
    documents: int
    agents: int
