"""HTTP-маршруты FastAPI по сущностям."""

from fastapi import APIRouter

from . import admin_config, applications, lead_behavior


def api_v1_router() -> APIRouter:
    r = APIRouter(prefix="/api/v1")
    r.include_router(applications.router)
    r.include_router(lead_behavior.router)
    r.include_router(admin_config.router)
    return r
