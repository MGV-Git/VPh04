from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from psycopg import AsyncConnection
from psycopg.errors import ForeignKeyViolation, UniqueViolation

from app.core.database import get_db_conn
from app.models.lead_behavior import LeadBehaviorMetrics, LeadBehaviorMetricsCRUD

router = APIRouter(prefix="/behavior-metrics", tags=["behavior-metrics"])


class LeadBehaviorCreate(BaseModel):
    application_id: int = Field(..., ge=1)
    time_on_page_seconds: float | None = Field(None, ge=0)
    button_clicks: dict[str, Any] = Field(default_factory=dict)
    cursor_hover_zones: dict[str, Any] = Field(default_factory=dict)
    return_visit_count: int = Field(0, ge=0)
    extra: dict[str, Any] = Field(default_factory=dict)

    @field_validator("button_clicks", "cursor_hover_zones", "extra")
    @classmethod
    def cap_json(cls, v: dict) -> dict:
        if len(str(v)) > 64_000:
            raise ValueError("json payload too large")
        return v


class LeadBehaviorPatch(BaseModel):
    time_on_page_seconds: float | None = Field(None, ge=0)
    button_clicks: dict[str, Any] | None = None
    cursor_hover_zones: dict[str, Any] | None = None
    return_visit_count: int | None = Field(None, ge=0)
    extra: dict[str, Any] | None = None


class LeadBehaviorOut(BaseModel):
    application_id: int
    created_at: str
    updated_at: str
    time_on_page_seconds: float | None
    button_clicks: dict[str, Any]
    cursor_hover_zones: dict[str, Any]
    return_visit_count: int
    extra: dict[str, Any]

    @classmethod
    def from_row(cls, row: LeadBehaviorMetrics) -> "LeadBehaviorOut":
        return cls(
            application_id=row.application_id,
            created_at=row.created_at.isoformat(),
            updated_at=row.updated_at.isoformat(),
            time_on_page_seconds=row.time_on_page_seconds,
            button_clicks=row.button_clicks,
            cursor_hover_zones=row.cursor_hover_zones,
            return_visit_count=row.return_visit_count,
            extra=row.extra,
        )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_behavior(
    body: LeadBehaviorCreate,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    try:
        aid = await LeadBehaviorMetricsCRUD.create(
            conn,
            application_id=body.application_id,
            time_on_page_seconds=body.time_on_page_seconds,
            button_clicks=body.button_clicks,
            cursor_hover_zones=body.cursor_hover_zones,
            return_visit_count=body.return_visit_count,
            extra=body.extra,
        )
    except ForeignKeyViolation as exc:
        raise HTTPException(
            status_code=400,
            detail="application_id does not exist",
        ) from exc
    except UniqueViolation as exc:
        raise HTTPException(
            status_code=409,
            detail="metrics for this application_id already exist",
        ) from exc
    row = await LeadBehaviorMetricsCRUD.get_by_application_id(conn, aid)
    if row is None:
        raise HTTPException(status_code=500, detail="create failed")
    return LeadBehaviorOut.from_row(row)


@router.get("", response_model=list[LeadBehaviorOut])
async def list_behavior(
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    rows = await LeadBehaviorMetricsCRUD.list_page(conn, limit=limit, offset=offset)
    return [LeadBehaviorOut.from_row(r) for r in rows]


@router.get("/{application_id}", response_model=LeadBehaviorOut)
async def get_behavior(
    application_id: int,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    row = await LeadBehaviorMetricsCRUD.get_by_application_id(conn, application_id)
    if row is None:
        raise HTTPException(status_code=404, detail="not found")
    return LeadBehaviorOut.from_row(row)


@router.patch("/{application_id}", response_model=LeadBehaviorOut)
async def patch_behavior(
    application_id: int,
    body: LeadBehaviorPatch,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    data = body.model_dump(exclude_unset=True)
    row = await LeadBehaviorMetricsCRUD.update(conn, application_id, **data)
    if row is None:
        raise HTTPException(status_code=404, detail="not found")
    return LeadBehaviorOut.from_row(row)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_behavior(
    application_id: int,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    ok = await LeadBehaviorMetricsCRUD.delete(conn, application_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
