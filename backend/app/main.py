import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.core.database import close_pool, create_pool
from app.routes import api_v1_router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await create_pool()
    app.state.db_pool = pool
    yield
    await close_pool(pool)


app = FastAPI(
    title="Leads & config API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
)

app.include_router(api_v1_router())


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
