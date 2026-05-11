import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.core.database import close_pool, create_pool
from app.routes import api_v1_router, public_behavior_metrics

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app")


def _show_openapi_docs() -> bool:
    """В Docker по умолчанию выключено (SHOW_API_DOCS=false); локально без переменной — включено."""
    raw = os.getenv("SHOW_API_DOCS")
    if raw is None:
        return True
    return raw.lower() in ("1", "true", "yes", "on")


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await create_pool()
    app.state.db_pool = pool
    yield
    await close_pool(pool)


_docs = _show_openapi_docs()
app = FastAPI(
    title="Leads & config API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/v1/docs" if _docs else None,
    redoc_url="/api/v1/redoc" if _docs else None,
    openapi_url="/api/v1/openapi.json" if _docs else None,
)

app.include_router(api_v1_router())
app.include_router(public_behavior_metrics.router)


@app.get("/api/v1/health")
async def health(request: Request):
    pool = request.app.state.db_pool
    try:
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT 1")
    except Exception as e:
        log.warning("health check failed: %s", e)
        return JSONResponse({"status": "down"}, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
    return {"status": "ok"}
