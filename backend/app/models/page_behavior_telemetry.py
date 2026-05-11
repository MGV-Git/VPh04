"""Сырые снимки поведения с публичной формы (POST /api/behavior-metrics/)."""

from datetime import datetime
from typing import Any

from psycopg import AsyncConnection


class PageBehaviorTelemetryCRUD:
    @classmethod
    async def insert_snapshot(
        cls,
        conn: AsyncConnection,
        *,
        application_id: int,
        time_on_page_seconds: float,
        buttons_clicked: str,
        cursor_positions: str,
        return_frequency: int,
    ) -> int:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO page_behavior_telemetry (
                    application_id, time_on_page_seconds,
                    buttons_clicked, cursor_positions, return_frequency
                ) VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    application_id,
                    time_on_page_seconds,
                    buttons_clicked,
                    cursor_positions,
                    return_frequency,
                ),
            )
            row = await cur.fetchone()
        await conn.commit()
        return int(row[0])

    @classmethod
    async def count_all(cls, conn: AsyncConnection) -> int:
        async with conn.cursor() as cur:
            await cur.execute("SELECT COUNT(*) FROM page_behavior_telemetry")
            row = await cur.fetchone()
        return int(row[0]) if row else 0

    @classmethod
    async def list_page(
        cls,
        conn: AsyncConnection,
        *,
        limit: int,
        offset: int,
    ) -> list[dict[str, Any]]:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, received_at, application_id, time_on_page_seconds,
                       buttons_clicked, cursor_positions, return_frequency
                FROM page_behavior_telemetry
                ORDER BY id DESC
                LIMIT %s OFFSET %s
                """,
                (limit, offset),
            )
            rows = await cur.fetchall()
        out: list[dict[str, Any]] = []
        for row in rows:
            rid, received_at, app_id, tsec, btn, curp, rfreq = row
            out.append(
                {
                    "id": int(rid),
                    "received_at": received_at.isoformat()
                    if isinstance(received_at, datetime)
                    else str(received_at),
                    "application_id": int(app_id),
                    "time_on_page_seconds": float(tsec) if tsec is not None else 0.0,
                    "buttons_clicked": str(btn or ""),
                    "cursor_positions": str(curp or ""),
                    "return_frequency": int(rfreq),
                }
            )
        return out
