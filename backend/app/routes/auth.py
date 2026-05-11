from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from psycopg import AsyncConnection
from psycopg.errors import UniqueViolation

from app.core.database import get_db_conn
from app.core.security import create_access_token, hash_password, verify_password
from app.models.admin_user import AdminUserCRUD

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginPayload(BaseModel):
    login: str = Field(..., min_length=3, max_length=128)
    password: str = Field(..., min_length=6, max_length=200)

    @field_validator("login", mode="before")
    @classmethod
    def normalize_login(cls, v):
        if not isinstance(v, str):
            return v
        return v.strip().lower()


class RegisterPayload(LoginPayload):
    pass


@router.get("/bootstrap")
async def bootstrap_auth_state(conn: Annotated[AsyncConnection, Depends(get_db_conn)]):
    count = await AdminUserCRUD.count(conn)
    return {"has_admins": count > 0}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_admin(
    body: RegisterPayload,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    count = await AdminUserCRUD.count(conn)
    if count > 0:
        raise HTTPException(status_code=403, detail="registration closed")

    try:
        new_id = await AdminUserCRUD.create(
            conn,
            login=body.login,
            password_hash=hash_password(body.password),
        )
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="login already exists") from exc

    token = create_access_token(admin_id=new_id, login=body.login)
    return {"token": token}


@router.post("/login")
async def login_admin(
    body: LoginPayload,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    admin = await AdminUserCRUD.get_by_login(conn, body.login)
    if admin is None or not verify_password(body.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="invalid login or password")
    token = create_access_token(admin_id=admin.id, login=admin.login)
    return {"token": token}
