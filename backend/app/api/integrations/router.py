from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.integrations.registry import integration_registry
from app.models.user import User


router = APIRouter()


class IntegrationRegisterRequest(BaseModel):
    integration_id: str
    config: dict[str, str | int | bool | None] = {}


class IntegrationUpdateRequest(BaseModel):
    config: dict[str, str | int | bool | None]


@router.get("/")
async def list_integrations(
    current_user: User = Depends(get_current_user),
):
    return integration_registry.list_integrations()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def register_integration(
    payload: IntegrationRegisterRequest,
    current_user: User = Depends(get_current_user),
):
    integration = integration_registry.get_integration(payload.integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    try:
        result = await integration.connect(payload.config)
        return {"integration_id": payload.integration_id, "status": "connected", "details": result}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{integration_id}")
async def update_integration(
    integration_id: str,
    payload: IntegrationUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    integration = integration_registry.get_integration(integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return {"integration_id": integration_id, "config": payload.config}


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_integration(
    integration_id: str,
    current_user: User = Depends(get_current_user),
):
    integration = integration_registry.get_integration(integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    integration_registry.unregister(integration_id)
    return None
