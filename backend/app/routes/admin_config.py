from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from psycopg import AsyncConnection

from app.core.database import get_db_conn
from app.models.admin_config import AdminSiteConfig, AdminSiteConfigCRUD

router = APIRouter(prefix="/admin-config", tags=["admin-config"])


class AdminConfigCreate(BaseModel):
    services_offered: list[Any] = Field(default_factory=list)
    budget_slider_config: dict[str, Any] = Field(default_factory=dict)
    ui_options: dict[str, Any] = Field(default_factory=dict)

    @field_validator("services_offered", "budget_slider_config", "ui_options")
    @classmethod
    def cap_size(cls, v):
        if len(str(v)) > 128_000:
            raise ValueError("payload too large")
        return v


class AdminConfigPatch(BaseModel):
    services_offered: list[Any] | None = None
    budget_slider_config: dict[str, Any] | None = None
    ui_options: dict[str, Any] | None = None


class AdminConfigOut(BaseModel):
    id: int
    created_at: str
    updated_at: str
    services_offered: list[Any]
    budget_slider_config: dict[str, Any]
    ui_options: dict[str, Any]

    @classmethod
    def from_row(cls, row: AdminSiteConfig) -> "AdminConfigOut":
        return cls(
            id=row.id,
            created_at=row.created_at.isoformat(),
            updated_at=row.updated_at.isoformat(),
            services_offered=row.services_offered,
            budget_slider_config=row.budget_slider_config,
            ui_options=row.ui_options,
        )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_admin_config(
    body: AdminConfigCreate,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    new_id = await AdminSiteConfigCRUD.create(
        conn,
        services_offered=body.services_offered,
        budget_slider_config=body.budget_slider_config,
        ui_options=body.ui_options,
    )
    row = await AdminSiteConfigCRUD.get_by_id(conn, new_id)
    if row is None:
        raise HTTPException(status_code=500, detail="create failed")
    return AdminConfigOut.from_row(row)


@router.get("", response_model=list[AdminConfigOut])
async def list_admin_config(
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    rows = await AdminSiteConfigCRUD.list_page(conn, limit=limit, offset=offset)
    return [AdminConfigOut.from_row(r) for r in rows]


@router.get("/{config_id}", response_model=AdminConfigOut)
async def get_admin_config(
    config_id: int,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    row = await AdminSiteConfigCRUD.get_by_id(conn, config_id)
    if row is None:
        raise HTTPException(status_code=404, detail="not found")
    return AdminConfigOut.from_row(row)


@router.patch("/{config_id}", response_model=AdminConfigOut)
async def patch_admin_config(
    config_id: int,
    body: AdminConfigPatch,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    data = body.model_dump(exclude_unset=True)
    row = await AdminSiteConfigCRUD.update(conn, config_id, **data)
    if row is None:
        raise HTTPException(status_code=404, detail="not found")
    return AdminConfigOut.from_row(row)


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_config(
    config_id: int,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    ok = await AdminSiteConfigCRUD.delete(conn, config_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
