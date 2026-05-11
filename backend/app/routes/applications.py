from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from psycopg import AsyncConnection

from app.core.database import get_db_conn
from app.models.application import LeadApplication, LeadApplicationCRUD

router = APIRouter(prefix="/applications", tags=["applications"])


class LeadApplicationCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=200)
    last_name: str = Field(..., min_length=1, max_length=200)
    patronymic: str | None = Field(None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=64)
    business_info: str = Field(default="", max_length=16_000)
    business_niche: str | None = Field(None, max_length=2000)
    company_size: str | None = Field(None, max_length=500)
    task_volume: str | None = Field(None, max_length=500)
    role_in_company: str | None = Field(None, max_length=200)
    business_size: str | None = Field(None, max_length=500)
    need_volume: str | None = Field(None, max_length=500)
    result_deadline: str | None = Field(None, max_length=500)
    task_type: str | None = Field(None, max_length=500)
    product_of_interest: str | None = Field(None, max_length=500)
    budget: str = Field(default="", max_length=200)
    preferred_contact_method: str | None = Field(None, max_length=200)
    convenient_contact_time: str | None = Field(None, max_length=200)
    comments: str | None = Field(None, max_length=16_000)

    @field_validator(
        "first_name",
        "last_name",
        "patronymic",
        "phone",
        "business_info",
        "business_niche",
        "company_size",
        "task_volume",
        "role_in_company",
        "business_size",
        "need_volume",
        "result_deadline",
        "task_type",
        "product_of_interest",
        "budget",
        "preferred_contact_method",
        "convenient_contact_time",
        "comments",
        mode="before",
    )
    @classmethod
    def strip_optional(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            return v.strip()
        return v


class LeadApplicationPatch(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=200)
    last_name: str | None = Field(None, min_length=1, max_length=200)
    patronymic: str | None = Field(None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=64)
    business_info: str | None = Field(None, max_length=16_000)
    business_niche: str | None = Field(None, max_length=2000)
    company_size: str | None = Field(None, max_length=500)
    task_volume: str | None = Field(None, max_length=500)
    role_in_company: str | None = Field(None, max_length=200)
    business_size: str | None = Field(None, max_length=500)
    need_volume: str | None = Field(None, max_length=500)
    result_deadline: str | None = Field(None, max_length=500)
    task_type: str | None = Field(None, max_length=500)
    product_of_interest: str | None = Field(None, max_length=500)
    budget: str | None = Field(None, max_length=200)
    preferred_contact_method: str | None = Field(None, max_length=200)
    convenient_contact_time: str | None = Field(None, max_length=200)
    comments: str | None = Field(None, max_length=16_000)


class LeadApplicationOut(BaseModel):
    id: int
    created_at: str
    updated_at: str
    first_name: str
    last_name: str
    patronymic: str | None
    email: str | None
    phone: str | None
    business_info: str
    business_niche: str | None
    company_size: str | None
    task_volume: str | None
    role_in_company: str | None
    business_size: str | None
    need_volume: str | None
    result_deadline: str | None
    task_type: str | None
    product_of_interest: str | None
    budget: str
    preferred_contact_method: str | None
    convenient_contact_time: str | None
    comments: str | None

    @classmethod
    def from_row(cls, row: LeadApplication) -> "LeadApplicationOut":
        return cls(
            id=row.id,
            created_at=row.created_at.isoformat(),
            updated_at=row.updated_at.isoformat(),
            first_name=row.first_name,
            last_name=row.last_name,
            patronymic=row.patronymic,
            email=row.email,
            phone=row.phone,
            business_info=row.business_info,
            business_niche=row.business_niche,
            company_size=row.company_size,
            task_volume=row.task_volume,
            role_in_company=row.role_in_company,
            business_size=row.business_size,
            need_volume=row.need_volume,
            result_deadline=row.result_deadline,
            task_type=row.task_type,
            product_of_interest=row.product_of_interest,
            budget=row.budget,
            preferred_contact_method=row.preferred_contact_method,
            convenient_contact_time=row.convenient_contact_time,
            comments=row.comments,
        )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_application(
    body: LeadApplicationCreate,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    new_id = await LeadApplicationCRUD.create(
        conn,
        first_name=body.first_name,
        last_name=body.last_name,
        patronymic=body.patronymic,
        email=str(body.email) if body.email is not None else None,
        phone=body.phone,
        business_info=body.business_info,
        business_niche=body.business_niche,
        company_size=body.company_size,
        task_volume=body.task_volume,
        role_in_company=body.role_in_company,
        business_size=body.business_size,
        need_volume=body.need_volume,
        result_deadline=body.result_deadline,
        task_type=body.task_type,
        product_of_interest=body.product_of_interest,
        budget=body.budget,
        preferred_contact_method=body.preferred_contact_method,
        convenient_contact_time=body.convenient_contact_time,
        comments=body.comments,
    )
    row = await LeadApplicationCRUD.get_by_id(conn, new_id)
    if row is None:
        raise HTTPException(status_code=500, detail="create failed")
    return LeadApplicationOut.from_row(row)


@router.get("", response_model=list[LeadApplicationOut])
async def list_applications(
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    rows = await LeadApplicationCRUD.list_page(conn, limit=limit, offset=offset)
    return [LeadApplicationOut.from_row(r) for r in rows]


@router.get("/{application_id}", response_model=LeadApplicationOut)
async def get_application(
    application_id: int,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    row = await LeadApplicationCRUD.get_by_id(conn, application_id)
    if row is None:
        raise HTTPException(status_code=404, detail="not found")
    return LeadApplicationOut.from_row(row)


@router.patch("/{application_id}", response_model=LeadApplicationOut)
async def patch_application(
    application_id: int,
    body: LeadApplicationPatch,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    data = body.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"])
    row = await LeadApplicationCRUD.update(conn, application_id, **data)
    if row is None:
        raise HTTPException(status_code=404, detail="not found")
    return LeadApplicationOut.from_row(row)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    application_id: int,
    conn: Annotated[AsyncConnection, Depends(get_db_conn)],
):
    ok = await LeadApplicationCRUD.delete(conn, application_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
