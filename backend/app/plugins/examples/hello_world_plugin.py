"""Example plugin: the canonical "hello world" of the plugin system.

Drop this file (or ``examples/hello_world_plugin.py``) into the configured
plugins directory and it will be auto-discovered, loaded, and wired into the
FastAPI app on startup.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from app.plugins.base import Plugin, PluginCategory, PluginMetadata
from app.plugins.events import Event

metadata = PluginMetadata(
    name="hello-world",
    version="0.1.0",
    description="Demonstrates route registration, services, and events.",
    author="SMARTER AI",
    category=PluginCategory.developer_extension,
    dependencies=(),
    enabled=True,
    priority=0,
)

router = APIRouter(prefix="/hello", tags=["hello-world"])


@router.get("/greeting")
async def greeting() -> dict[str, str]:
    """Return a friendly greeting from the plugin."""
    return {"message": "Hello from the hello-world plugin!"}


@router.get("/echo")
async def echo(request: Request) -> dict[str, Any]:
    """Echo query parameters back, showcasing request access."""
    return {"params": dict(request.query_params)}


class HelloWorldPlugin(Plugin):
    """Minimal plugin exercising every extension point."""

    metadata: PluginMetadata = metadata

    async def initialize(self, settings: Any | None = None) -> None:
        print(f"[{self.metadata.name}] initialize() called with settings: {settings is not None}")

    async def shutdown(self) -> None:
        print(f"[{self.metadata.name}] shutdown() called")

    def get_routes(self) -> list[APIRouter]:
        return [router]

    def get_services(self) -> dict[str, Any]:
        def greeter(name: str = "world") -> str:
            return f"Hello, {name}!"

        return {"hello_greeter": greeter}

    def get_event_handlers(self) -> dict[str, Any]:
        async def on_event(event: Event) -> None:
            print(f"[{self.metadata.name}] received event '{event.name}': {event.data}")

        return {"plugin_registered": on_event}


PLUGIN: Plugin = HelloWorldPlugin()
