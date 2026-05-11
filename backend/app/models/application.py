"""Заявка «тёплого клиента»: контакты, бизнес, бюджет, способ связи, комментарии и поля формы."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from psycopg import AsyncConnection


@dataclass(slots=True)
class LeadApplication:
    """
    Модель строки таблицы заявок.

    SQL для генерации таблицы:

    ```sql
    CREATE TABLE IF NOT EXISTS lead_applications (
        id                          BIGSERIAL PRIMARY KEY,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
        first_name                  TEXT NOT NULL,
        last_name                   TEXT NOT NULL,
        patronymic                  TEXT,
        email                       TEXT,
        phone                       TEXT,
        business_info               TEXT NOT NULL DEFAULT '',
        business_niche              TEXT,
        company_size                TEXT,
        task_volume                 TEXT,
        role_in_company             TEXT,
        business_size               TEXT,
        need_volume                 TEXT,
        result_deadline             TEXT,
        task_type                   TEXT,
        product_of_interest         TEXT,
        budget                      TEXT NOT NULL DEFAULT '',
        preferred_contact_method    TEXT,
        convenient_contact_time     TEXT,
        comments                    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_lead_applications_created
        ON lead_applications (created_at DESC);
    ```
    """

    id: int
    created_at: datetime
    updated_at: datetime
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


class LeadApplicationCRUD:
    """
    CRUD для ``lead_applications``.

    SQL для генерации таблицы:

    ```sql
    CREATE TABLE IF NOT EXISTS lead_applications (
        id                          BIGSERIAL PRIMARY KEY,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
        first_name                  TEXT NOT NULL,
        last_name                   TEXT NOT NULL,
        patronymic                  TEXT,
        email                       TEXT,
        phone                       TEXT,
        business_info               TEXT NOT NULL DEFAULT '',
        business_niche              TEXT,
        company_size                TEXT,
        task_volume                 TEXT,
        role_in_company             TEXT,
        business_size               TEXT,
        need_volume                 TEXT,
        result_deadline             TEXT,
        task_type                   TEXT,
        product_of_interest         TEXT,
        budget                      TEXT NOT NULL DEFAULT '',
        preferred_contact_method    TEXT,
        convenient_contact_time     TEXT,
        comments                    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_lead_applications_created
        ON lead_applications (created_at DESC);
    ```
    """

    _select_base = """
        SELECT id, created_at, updated_at, first_name, last_name, patronymic,
               email, phone, business_info, business_niche, company_size, task_volume,
               role_in_company, business_size, need_volume, result_deadline,
               task_type, product_of_interest, budget, preferred_contact_method,
               convenient_contact_time, comments
        FROM lead_applications
    """

    @classmethod
    def _row_to_model(cls, row: Any) -> LeadApplication:
        return LeadApplication(
            id=row[0],
            created_at=row[1],
            updated_at=row[2],
            first_name=row[3],
            last_name=row[4],
            patronymic=row[5],
            email=row[6],
            phone=row[7],
            business_info=row[8] or "",
            business_niche=row[9],
            company_size=row[10],
            task_volume=row[11],
            role_in_company=row[12],
            business_size=row[13],
            need_volume=row[14],
            result_deadline=row[15],
            task_type=row[16],
            product_of_interest=row[17],
            budget=row[18] or "",
            preferred_contact_method=row[19],
            convenient_contact_time=row[20],
            comments=row[21],
        )

    @classmethod
    async def create(
        cls,
        conn: AsyncConnection,
        *,
        first_name: str,
        last_name: str,
        patronymic: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        business_info: str = "",
        business_niche: str | None = None,
        company_size: str | None = None,
        task_volume: str | None = None,
        role_in_company: str | None = None,
        business_size: str | None = None,
        need_volume: str | None = None,
        result_deadline: str | None = None,
        task_type: str | None = None,
        product_of_interest: str | None = None,
        budget: str = "",
        preferred_contact_method: str | None = None,
        convenient_contact_time: str | None = None,
        comments: str | None = None,
    ) -> int:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO lead_applications (
                    first_name, last_name, patronymic, email, phone,
                    business_info, business_niche, company_size, task_volume,
                    role_in_company, business_size, need_volume, result_deadline,
                    task_type, product_of_interest, budget,
                    preferred_contact_method, convenient_contact_time, comments
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s
                )
                RETURNING id
                """,
                (
                    first_name,
                    last_name,
                    patronymic,
                    email,
                    phone,
                    business_info,
                    business_niche,
                    company_size,
                    task_volume,
                    role_in_company,
                    business_size,
                    need_volume,
                    result_deadline,
                    task_type,
                    product_of_interest,
                    budget,
                    preferred_contact_method,
                    convenient_contact_time,
                    comments,
                ),
            )
            row = await cur.fetchone()
        await conn.commit()
        return int(row[0])

    @classmethod
    async def get_by_id(cls, conn: AsyncConnection, application_id: int) -> LeadApplication | None:
        async with conn.cursor() as cur:
            await cur.execute(cls._select_base + " WHERE id = %s", (application_id,))
            row = await cur.fetchone()
        if row is None:
            return None
        return cls._row_to_model(row)

    @classmethod
    async def list_page(
        cls,
        conn: AsyncConnection,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[LeadApplication]:
        lim = max(1, min(limit, 200))
        off = max(0, offset)
        async with conn.cursor() as cur:
            await cur.execute(
                cls._select_base + " ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (lim, off),
            )
            rows = await cur.fetchall()
        return [cls._row_to_model(r) for r in rows]

    @classmethod
    async def update(
        cls,
        conn: AsyncConnection,
        application_id: int,
        *,
        first_name: str | None = None,
        last_name: str | None = None,
        patronymic: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        business_info: str | None = None,
        business_niche: str | None = None,
        company_size: str | None = None,
        task_volume: str | None = None,
        role_in_company: str | None = None,
        business_size: str | None = None,
        need_volume: str | None = None,
        result_deadline: str | None = None,
        task_type: str | None = None,
        product_of_interest: str | None = None,
        budget: str | None = None,
        preferred_contact_method: str | None = None,
        convenient_contact_time: str | None = None,
        comments: str | None = None,
    ) -> LeadApplication | None:
        fields: list[str] = []
        values: list[Any] = []
        mapping = [
            ("first_name", first_name),
            ("last_name", last_name),
            ("patronymic", patronymic),
            ("email", email),
            ("phone", phone),
            ("business_info", business_info),
            ("business_niche", business_niche),
            ("company_size", company_size),
            ("task_volume", task_volume),
            ("role_in_company", role_in_company),
            ("business_size", business_size),
            ("need_volume", need_volume),
            ("result_deadline", result_deadline),
            ("task_type", task_type),
            ("product_of_interest", product_of_interest),
            ("budget", budget),
            ("preferred_contact_method", preferred_contact_method),
            ("convenient_contact_time", convenient_contact_time),
            ("comments", comments),
        ]
        for col, val in mapping:
            if val is not None:
                fields.append(f"{col} = %s")
                values.append(val)
        if not fields:
            return await cls.get_by_id(conn, application_id)
        values.append(application_id)
        async with conn.cursor() as cur:
            await cur.execute(
                f"""
                UPDATE lead_applications
                SET {", ".join(fields)}, updated_at = now()
                WHERE id = %s
                """,
                values,
            )
        await conn.commit()
        return await cls.get_by_id(conn, application_id)

    @classmethod
    async def delete(cls, conn: AsyncConnection, application_id: int) -> bool:
        async with conn.cursor() as cur:
            await cur.execute("DELETE FROM lead_applications WHERE id = %s", (application_id,))
            deleted = cur.rowcount
        await conn.commit()
        return deleted > 0

    @classmethod
    async def count(cls, conn: AsyncConnection) -> int:
        async with conn.cursor() as cur:
            await cur.execute("SELECT count(*) FROM lead_applications")
            row = await cur.fetchone()
        return int(row[0]) if row else 0
