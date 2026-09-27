from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.plugins.registry import get_plugin_registry
from app.integrations.registry import integration_registry
from app.agents.registry import get_agent_registry

agent_registry = get_agent_registry()

plugin_registry = get_plugin_registry()


router = APIRouter()


@router.get("/agents")
async def list_marketplace_agents(
    capability: str | None = None,
    category: str | None = None,
    current_user: User = Depends(get_current_user),
):
    agents = agent_registry.list_agents(capability=capability, category=category)
    return [
        {
            "agent_id": agent.metadata.agent_id,
            "name": agent.metadata.name,
            "version": agent.metadata.version,
            "description": agent.metadata.description,
            "capabilities": [c.value for c in agent.metadata.capabilities],
            "author": agent.metadata.author,
            "supported_languages": agent.metadata.supported_languages,
            "difficulty_levels": agent.metadata.difficulty_levels,
            "category": agent.metadata.category,
        }
        for agent in agents
    ]


@router.get("/plugins")
async def list_plugins(
    category: str | None = None,
    current_user: User = Depends(get_current_user),
):
    plugins = plugin_registry.get_all_plugins()
    result = []
    for plugin in plugins:
        meta = plugin.metadata
        if category and meta.category.value != category:
            continue
        result.append({
            "name": meta.name,
            "version": meta.version,
            "description": meta.description,
            "author": meta.author,
            "category": meta.category.value,
            "dependencies": meta.dependencies,
            "enabled": meta.enabled,
        })
    return result


@router.get("/integrations")
async def list_integrations(
    current_user: User = Depends(get_current_user),
):
    return integration_registry.list_integrations()


@router.get("/schema")
async def get_openapi_schema(
    current_user: User = Depends(get_current_user),
):
    from app.main import app
    return app.openapi()


@router.get("/sdk")
async def get_sdk_config(
    current_user: User = Depends(get_current_user),
):
    return {
        "base_url": "/api/v1",
        "auth": "Bearer token",
        "endpoints": {
            "agents": "/agents",
            "plugins": "/plugins",
            "integrations": "/integrations",
            "webhooks": "/webhooks",
            "schema": "/schema",
        },
        "sdk_version": "1.0.0",
    }
