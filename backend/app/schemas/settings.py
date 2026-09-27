from pydantic import BaseModel


class SettingsRead(BaseModel):
    theme: str
    model: str
    voice_enabled: bool
    memory_enabled: bool

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    theme: str | None = None
    model: str | None = None
    voice_enabled: bool | None = None
    memory_enabled: bool | None = None

