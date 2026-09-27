from pydantic import BaseModel, Field, HttpUrl


class URLContextRequest(BaseModel):
    url: HttpUrl


class URLContextResponse(BaseModel):
    type: str = "web"
    name: str
    source_url: str
    content_type: str = "text/html"
    text: str = Field(default="")
    summary: str = Field(default="")
