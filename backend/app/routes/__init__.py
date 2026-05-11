"""HTTP-маршруты FastAPI по сущностям."""

from fastapi import APIRouter

from . import admin_config, admins, applications, auth, lead_behavior, page_behavior_admin


def api_v1_router() -> APIRouter:
    r = APIRouter(prefix="/api/v1")
    r.include_router(applications.router)
    r.include_router(lead_behavior.router)
    r.include_router(page_behavior_admin.router)
    r.include_router(admin_config.router)
    r.include_router(auth.router)
    r.include_router(admins.router)
    return r
