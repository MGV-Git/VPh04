from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from psycopg import AsyncConnection
from psycopg.errors import UndefinedTable
from pydantic import BaseModel

from app.core.database import get_db_conn
from app.core.security import get_current_admin
from app.models.page_behavior_telemetry import PageBehaviorTelemetryCRUD

router = APIRouter(
    prefix="/page-behavior-telemetry",
    tags=["page-behavior-telemetry"],
)


class PageTelemetryRowOut(BaseModel):
    id: int
    received_at: str
    application_id: int
    time_on_page_seconds: float
    buttons_clicked: str
    cursor_positions: str
    return_frequency: int


class PageTelemetryListOut(BaseModel):
    total: int
    items: list[PageTelemetryRowOut]


@router.get("", response_model=PageTelemetryListOut)
async def list_page_behavior_telemetry(
    _: Annotated[object, Depends(get_current_admin)],
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    try:
        total = await PageBehaviorTelemetryCRUD.count_all(conn)
        rows = await PageBehaviorTelemetryCRUD.list_page(conn, limit=limit, offset=offset)
    except UndefinedTable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "В базе нет таблицы page_behavior_telemetry. "
                "Выполните на сервере SQL из файла db/migrations/002_page_behavior_telemetry.sql "
                "(например: docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f ...)."
            ),
        ) from exc
    return PageTelemetryListOut(
        total=total,
        items=[PageTelemetryRowOut(**r) for r in rows],
    )
