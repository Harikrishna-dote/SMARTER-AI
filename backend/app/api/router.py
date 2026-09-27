from fastapi import APIRouter

from app.api.brain.router import router as brain_router
from app.api.admin.router import router as admin_router
from app.api.agents.router import router as agents_router
from app.api.assessment.router import router as assessment_router
from app.api.classroom.router import router as classroom_router
from app.api.auth.router import router as auth_router
from app.api.chats.router import router as chats_router
from app.api.documents.router import router as documents_router
from app.api.learning.router import router as learning_router
from app.api.memory.router import router as memory_router
from app.api.operations.router import router as operations_router
from app.api.settings.router import router as settings_router
from app.api.translation.router import router as translation_router
from app.api.users.router import router as users_router
from app.api.vision.router import router as vision_router
from app.api.voice.router import router as voice_router
from app.api.search.router import router as search_router
from app.api.ecosystem.router import router as ecosystem_router
from app.api.developer.router import router as developer_router
from app.api.integrations.router import router as integrations_router
from app.api.analytics.router import router as analytics_router
from app.api.audit.router import router as audit_router


api_router = APIRouter()
api_router.include_router(brain_router, prefix="/brain", tags=["brain"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(chats_router, prefix="/chats", tags=["chats"])
api_router.include_router(memory_router, prefix="/memory", tags=["memory"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(learning_router, prefix="/learning", tags=["learning"])
api_router.include_router(assessment_router, prefix="/assessment", tags=["assessment"])
api_router.include_router(operations_router, prefix="/operations", tags=["operations"])
api_router.include_router(agents_router, prefix="/agents", tags=["agents"])
api_router.include_router(voice_router, prefix="/voice", tags=["voice"])
api_router.include_router(vision_router, prefix="/vision", tags=["vision"])
api_router.include_router(settings_router, prefix="/settings", tags=["settings"])
api_router.include_router(translation_router, prefix="/translation", tags=["translation"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(search_router, prefix="/search", tags=["search"])
api_router.include_router(classroom_router, prefix="/classroom", tags=["classroom"])
api_router.include_router(ecosystem_router, prefix="/ecosystem", tags=["ecosystem"])
api_router.include_router(developer_router, prefix="/developer", tags=["developer"])
api_router.include_router(integrations_router, prefix="/integrations", tags=["integrations"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(audit_router, prefix="/audit", tags=["audit"])
