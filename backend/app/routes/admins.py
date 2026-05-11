from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from psycopg import AsyncConnection
from psycopg.errors import UniqueViolation

from app.core.database import get_db_conn
from app.core.security import get_current_admin, hash_password
from app.models.admin_user import AdminUser, AdminUserCRUD

router = APIRouter(
    prefix="/admins",
    tags=["admins"],
    dependencies=[Depends(get_current_admin)],
)


class AdminCreate(BaseModel):
    login: str = Field(..., min_length=3, max_length=128)
    password: str = Field(..., min_length=6, max_length=200)

    @field_validator("login", mode="before")
    @classmethod
    def normalize_login(cls, v):
        if not isinstance(v, str):
            return v
        return v.strip().lower()


class AdminPatch(BaseModel):
    login: str | None = Field(None, min_length=3, max_length=128)
    password: str | None = Field(None, min_length=6, max_length=200)

    @field_validator("login", mode="before")
    @classmethod
    def normalize_login(cls, v):
        if not isinstance(v, str):
            return v
        return v.strip().lower()


class AdminOut(BaseModel):
    id: int
    created_at: str
    updated_at: str
    login: str

    @classmethod
    def from_row(cls, row: AdminUser) -> "AdminOut":
        return cls(
            id=row.id,
            created_at=row.created_at.isoformat(),
            updated_at=row.updated_at.isoformat(),
            login=row.login,
        )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=AdminOut)
async def create_admin(
    body: AdminCreate,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    try:
        new_id = await AdminUserCRUD.create(
            conn,
            login=body.login,
            password_hash=hash_password(body.password),
        )
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="login already exists") from exc
    row = await AdminUserCRUD.get_by_id(conn, new_id)
    if row is None:
        raise HTTPException(status_code=500, detail="create failed")
    return AdminOut.from_row(row)


@router.get("", response_model=list[AdminOut])
async def list_admins(
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    rows = await AdminUserCRUD.list_page(conn, limit=limit, offset=offset)
    return [AdminOut.from_row(r) for r in rows]


@router.patch("/{admin_id}", response_model=AdminOut)
async def patch_admin(
    admin_id: int,
    body: AdminPatch,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    data = body.model_dump(exclude_unset=True)
    if "password" in data:
        data["password_hash"] = hash_password(data.pop("password"))
    try:
        row = await AdminUserCRUD.update(conn, admin_id, **data)
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="login already exists") from exc
    if row is None:
        raise HTTPException(status_code=404, detail="not found")
    return AdminOut.from_row(row)


@router.delete("/{admin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin(
    admin_id: int,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    ok = await AdminUserCRUD.delete(conn, admin_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
