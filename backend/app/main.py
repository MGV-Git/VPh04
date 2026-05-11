import json
import logging
from contextlib import asynccontextmanager
from ipaddress import ip_address
from typing import Any

import psycopg
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field, field_validator

from .settings import settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("leads")

_conn: psycopg.AsyncConnection | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _conn
    _conn = await psycopg.AsyncConnection.connect(settings.database_url)
    yield
    if _conn:
        await _conn.close()


app = FastAPI(
    title="Leads API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


class LeadBody(BaseModel):
    """Валидация входящего JSON; PII не уходит наружу приложения."""

    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    phone: str | None = Field(None, max_length=40)
    message: str | None = Field(None, max_length=4000)
    utm: dict[str, str] = Field(default_factory=dict)
    metrics: dict[str, Any] = Field(default_factory=dict)
    technical: dict[str, Any] = Field(default_factory=dict)

    @field_validator("name", "phone", "message", mode="before")
    @classmethod
    def strip_strings(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("utm", "metrics", "technical")
    @classmethod
    def cap_json_size(cls, v: dict) -> dict:
        raw = json.dumps(v, ensure_ascii=False)
        if len(raw) > 32_000:
            raise ValueError("payload section too large")
        return v


def _normalize_email(email: str) -> str:
    return email.lower().strip()


@app.post("/api/v1/leads")
async def create_lead(request: Request, body: LeadBody):
    if _conn is None:
        raise HTTPException(status_code=503, detail="database unavailable")

    client_ip = request.client.host if request.client else None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    try:
        ip_obj = ip_address(client_ip) if client_ip else None
    except ValueError:
        ip_obj = None

    payload = body.model_dump(mode="json")
    ua = request.headers.get("user-agent", "")[:2000]
    norm_email = _normalize_email(body.email)

    async with _conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO leads (payload, client_ip, user_agent, normalized_email)
            VALUES (%s::jsonb, %s::inet, %s, %s)
            RETURNING id, created_at
            """,
            (
                json.dumps(payload, ensure_ascii=False),
                str(ip_obj) if ip_obj else None,
                ua,
                norm_email,
            ),
        )
        row = await cur.fetchone()
    await _conn.commit()

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={"id": row[0], "created_at": row[1].isoformat()},
    )


@app.get("/api/v1/health")
async def health():
    if _conn is None:
        return JSONResponse({"status": "down"}, status_code=503)
    try:
        async with _conn.cursor() as cur:
            await cur.execute("SELECT 1")
    except Exception as e:
        log.warning("health check failed: %s", e)
        return JSONResponse({"status": "down"}, status_code=503)
    return {"status": "ok"}
