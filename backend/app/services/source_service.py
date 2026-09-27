from html.parser import HTMLParser
from urllib.parse import urlparse
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.services.ai_gateway import AIGateway


class ReadableHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self._in_title = False
        self._skip_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True

    def handle_endtag(self, tag: str):
        if tag in {"script", "style", "noscript", "svg"} and self._skip_depth:
            self._skip_depth -= 1
        if tag == "title":
            self._in_title = False
        if tag in {"p", "br", "li", "h1", "h2", "h3", "section", "article"}:
            self.parts.append("\n")

    def handle_data(self, data: str):
        text = " ".join(data.split())
        if not text or self._skip_depth:
            return
        if self._in_title:
            self.title = f"{self.title} {text}".strip()
        else:
            self.parts.append(text)

    def readable_text(self) -> str:
        lines = [" ".join(line.split()) for line in "\n".join(self.parts).splitlines()]
        return "\n".join(line for line in lines if line)


class SourceService:
    def __init__(self, gateway: AIGateway | None = None):
        self.settings = get_settings()
        self.gateway = gateway or AIGateway()

    async def extract_url_context(self, url: str) -> dict:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only http and https URLs are supported",
            )

        try:
            async with httpx.AsyncClient(
                timeout=self.settings.web_context_timeout_seconds,
                follow_redirects=True,
                headers={"User-Agent": "SMARTER-AI-Tutor/1.0"},
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to read that URL",
            ) from exc

        parser = ReadableHTMLParser()
        content_type = response.headers.get("content-type", "text/html").split(";")[0]
        body = response.text
        if "html" in content_type:
            parser.feed(body)
            text = parser.readable_text()
            name = parser.title or parsed.netloc
        else:
            text = body
            name = parsed.path.rsplit("/", 1)[-1] or parsed.netloc

        text = text[: self.settings.max_context_chars]
        summary = await self._safe_summary(name, text)
        return {
            "type": "web",
            "name": name[:180],
            "source_url": url,
            "content_type": content_type,
            "text": text,
            "summary": summary,
        }

    async def _safe_summary(self, name: str, text: str) -> str:
        if not text.strip():
            return "The page was reachable, but no readable text was extracted."
        try:
            return await self.gateway.chat(
                [
                    {
                        "role": "system",
                        "content": "Summarize webpage text into concise learning context for a tutor.",
                    },
                    {"role": "user", "content": f"Source: {name}\n\n{text[:6000]}"},
                ]
            )
        except (httpx.HTTPError, TimeoutError):
            return "Web text was extracted. Local AI summary is unavailable because the language model is offline."
