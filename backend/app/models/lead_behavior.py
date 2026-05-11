"""Поведенческие и технические метрики лида; связь 1:1 с заявкой по ``application_id`` (PK)."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from psycopg import AsyncConnection
from psycopg.types.json import Json


@dataclass(slots=True)
class LeadBehaviorMetrics:
    """
    Модель строки таблицы метрик.

    SQL для генерации таблицы:

    ```sql
    CREATE TABLE IF NOT EXISTS lead_behavior_metrics (
        application_id          BIGINT PRIMARY KEY
            REFERENCES lead_applications(id) ON DELETE CASCADE,
        created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
        time_on_page_seconds      DOUBLE PRECISION,
        button_clicks             JSONB NOT NULL DEFAULT '{}'::jsonb,
        cursor_hover_zones        JSONB NOT NULL DEFAULT '{}'::jsonb,
        return_visit_count        INTEGER NOT NULL DEFAULT 0,
        extra                     JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    ```
    """

    application_id: int
    created_at: datetime
    updated_at: datetime
    time_on_page_seconds: float | None
    button_clicks: dict[str, Any]
    cursor_hover_zones: dict[str, Any]
    return_visit_count: int
    extra: dict[str, Any]


class LeadBehaviorMetricsCRUD:
    """
    CRUD для ``lead_behavior_metrics`` (1:1 с ``lead_applications``).

    SQL для генерации таблицы:

    ```sql
    CREATE TABLE IF NOT EXISTS lead_behavior_metrics (
        application_id          BIGINT PRIMARY KEY
            REFERENCES lead_applications(id) ON DELETE CASCADE,
        created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
        time_on_page_seconds      DOUBLE PRECISION,
        button_clicks             JSONB NOT NULL DEFAULT '{}'::jsonb,
        cursor_hover_zones        JSONB NOT NULL DEFAULT '{}'::jsonb,
        return_visit_count        INTEGER NOT NULL DEFAULT 0,
        extra                     JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    ```
    """

    _select_base = """
        SELECT application_id, created_at, updated_at, time_on_page_seconds,
               button_clicks, cursor_hover_zones, return_visit_count, extra
        FROM lead_behavior_metrics
    """

    @classmethod
    def _row_to_model(cls, row: Any) -> LeadBehaviorMetrics:
        return LeadBehaviorMetrics(
            application_id=row[0],
            created_at=row[1],
            updated_at=row[2],
            time_on_page_seconds=float(row[3]) if row[3] is not None else None,
            button_clicks=row[4] if isinstance(row[4], dict) else {},
            cursor_hover_zones=row[5] if isinstance(row[5], dict) else {},
            return_visit_count=int(row[6]),
            extra=row[7] if isinstance(row[7], dict) else {},
        )

    @classmethod
    async def create(
        cls,
        conn: AsyncConnection,
        *,
        application_id: int,
        time_on_page_seconds: float | None = None,
        button_clicks: dict[str, Any] | None = None,
        cursor_hover_zones: dict[str, Any] | None = None,
        return_visit_count: int = 0,
        extra: dict[str, Any] | None = None,
    ) -> int:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO lead_behavior_metrics (
                    application_id, time_on_page_seconds, button_clicks,
                    cursor_hover_zones, return_visit_count, extra
                ) VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING application_id
                """,
                (
                    application_id,
                    time_on_page_seconds,
                    Json(button_clicks or {}),
                    Json(cursor_hover_zones or {}),
                    return_visit_count,
                    Json(extra or {}),
                ),
            )
            row = await cur.fetchone()
        await conn.commit()
        return int(row[0])

    @classmethod
    async def get_by_application_id(
        cls,
        conn: AsyncConnection,
        application_id: int,
    ) -> LeadBehaviorMetrics | None:
        async with conn.cursor() as cur:
            await cur.execute(cls._select_base + " WHERE application_id = %s", (application_id,))
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
    ) -> list[LeadBehaviorMetrics]:
        lim = max(1, min(limit, 200))
        off = max(0, offset)
        async with conn.cursor() as cur:
            await cur.execute(
                cls._select_base + " ORDER BY updated_at DESC LIMIT %s OFFSET %s",
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
        time_on_page_seconds: float | None = None,
        button_clicks: dict[str, Any] | None = None,
        cursor_hover_zones: dict[str, Any] | None = None,
        return_visit_count: int | None = None,
        extra: dict[str, Any] | None = None,
    ) -> LeadBehaviorMetrics | None:
        fields: list[str] = []
        values: list[Any] = []
        if time_on_page_seconds is not None:
            fields.append("time_on_page_seconds = %s")
            values.append(time_on_page_seconds)
        if button_clicks is not None:
            fields.append("button_clicks = %s")
            values.append(Json(button_clicks))
        if cursor_hover_zones is not None:
            fields.append("cursor_hover_zones = %s")
            values.append(Json(cursor_hover_zones))
        if return_visit_count is not None:
            fields.append("return_visit_count = %s")
            values.append(return_visit_count)
        if extra is not None:
            fields.append("extra = %s")
            values.append(Json(extra))
        if not fields:
            return await cls.get_by_application_id(conn, application_id)
        values.append(application_id)
        async with conn.cursor() as cur:
            await cur.execute(
                f"""
                UPDATE lead_behavior_metrics
                SET {", ".join(fields)}, updated_at = now()
                WHERE application_id = %s
                """,
                values,
            )
        await conn.commit()
        return await cls.get_by_application_id(conn, application_id)

    @classmethod
    async def delete(cls, conn: AsyncConnection, application_id: int) -> bool:
        async with conn.cursor() as cur:
            await cur.execute(
                "DELETE FROM lead_behavior_metrics WHERE application_id = %s",
                (application_id,),
            )
            deleted = cur.rowcount
        await conn.commit()
        return deleted > 0
