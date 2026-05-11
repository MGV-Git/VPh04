from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from psycopg import AsyncConnection
from psycopg.errors import UndefinedTable
from pydantic import BaseModel, Field

from app.core.database import get_db_conn
from app.models.page_behavior_telemetry import PageBehaviorTelemetryCRUD
from app.settings import settings

router = APIRouter(prefix="/api/behavior-metrics", tags=["behavior-metrics-public"])


def _trusted_behavior_host_set() -> frozenset[str]:
    """Хосты, с которых разрешён приём метрик; пустой набор = проверка отключена (локальная отладка)."""
    parts: list[str] = []
    for raw in (settings.behavior_metrics_trusted_hosts, settings.nginx_main_server_name):
        for h in raw.split(","):
            h = h.strip().lower()
            if h:
                parts.append(h)
    return frozenset(parts)


def _request_host_candidates(request: Request) -> set[str]:
    out: set[str] = set()
    for header_name in ("origin", "referer"):
        url = request.headers.get(header_name)
        if not url or url.strip().lower() == "null":
            continue
        try:
            parsed = urlparse(url.strip())
            if parsed.hostname:
                out.add(parsed.hostname.lower())
        except Exception:
            continue
    host_header = request.headers.get("host") or ""
    if host_header:
        out.add(host_header.split(":")[0].lower())
    return out


def _enforce_trusted_behavior_host(request: Request) -> None:
    allowed = _trusted_behavior_host_set()
    if not allowed:
        return
    got = _request_host_candidates(request)
    if not got or not (got & allowed):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Метрики принимаются только с разрешённых хостов этого сайта (см. BEHAVIOR_METRICS_TRUSTED_HOSTS и NGINX_MAIN_SERVER_NAME).",
        )


class PublicBehaviorMetricsIn(BaseModel):
    application_id: int = Field(0, ge=0)
    time_on_page: float = Field(0, ge=0)
    buttons_clicked: str = Field("", max_length=256_000)
    cursor_positions: str = Field("", max_length=512_000)
    return_frequency: int = Field(0, ge=0)


class PublicBehaviorMetricsOut(BaseModel):
    id: int


@router.post("/", status_code=status.HTTP_201_CREATED)
async def ingest_public_behavior_metrics(
    request: Request,
    body: PublicBehaviorMetricsIn,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    _enforce_trusted_behavior_host(request)
    try:
        row_id = await PageBehaviorTelemetryCRUD.insert_snapshot(
            conn,
            application_id=body.application_id,
            time_on_page_seconds=body.time_on_page,
            buttons_clicked=body.buttons_clicked,
            cursor_positions=body.cursor_positions,
            return_frequency=body.return_frequency,
        )
    except UndefinedTable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Таблица page_behavior_telemetry не создана в БД. Примените db/migrations/002_page_behavior_telemetry.sql",
        ) from exc
    return PublicBehaviorMetricsOut(id=row_id)
