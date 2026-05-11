"""Админ-конфигурация: услуги, диапазон бюджета и прочие настройки UI (JSON)."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from psycopg import AsyncConnection
from psycopg.types.json import Json


@dataclass(slots=True)
class AdminSiteConfig:
    """
    Модель строки таблицы админ-данных.

    SQL для генерации таблицы:

    ```sql
    CREATE TABLE IF NOT EXISTS site_admin_config (
        id                    BIGSERIAL PRIMARY KEY,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        services_offered      JSONB NOT NULL DEFAULT '[]'::jsonb,
        budget_slider_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
        ui_options            JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    ```
    """

    id: int
    created_at: datetime
    updated_at: datetime
    services_offered: list[Any]
    budget_slider_config: dict[str, Any]
    ui_options: dict[str, Any]


class AdminSiteConfigCRUD:
    """
    CRUD для ``site_admin_config``.

    SQL для генерации таблицы:

    ```sql
    CREATE TABLE IF NOT EXISTS site_admin_config (
        id                    BIGSERIAL PRIMARY KEY,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        services_offered      JSONB NOT NULL DEFAULT '[]'::jsonb,
        budget_slider_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
        ui_options            JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    ```
    """

    _select_base = """
        SELECT id, created_at, updated_at, services_offered,
               budget_slider_config, ui_options
        FROM site_admin_config
    """

    @classmethod
    def _row_to_model(cls, row: Any) -> AdminSiteConfig:
        services = row[3]
        if not isinstance(services, list):
            services = []
        budget = row[4]
        if not isinstance(budget, dict):
            budget = {}
        ui = row[5]
        if not isinstance(ui, dict):
            ui = {}
        return AdminSiteConfig(
            id=row[0],
            created_at=row[1],
            updated_at=row[2],
            services_offered=services,
            budget_slider_config=budget,
            ui_options=ui,
        )

    @classmethod
    async def create(
        cls,
        conn: AsyncConnection,
        *,
        services_offered: list[Any] | None = None,
        budget_slider_config: dict[str, Any] | None = None,
        ui_options: dict[str, Any] | None = None,
    ) -> int:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO site_admin_config (
                    services_offered, budget_slider_config, ui_options
                ) VALUES (%s, %s, %s)
                RETURNING id
                """,
                (
                    Json(services_offered or []),
                    Json(budget_slider_config or {}),
                    Json(ui_options or {}),
                ),
            )
            row = await cur.fetchone()
        await conn.commit()
        return int(row[0])

    @classmethod
    async def get_by_id(cls, conn: AsyncConnection, config_id: int) -> AdminSiteConfig | None:
        async with conn.cursor() as cur:
            await cur.execute(cls._select_base + " WHERE id = %s", (config_id,))
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
    ) -> list[AdminSiteConfig]:
        lim = max(1, min(limit, 200))
        off = max(0, offset)
        async with conn.cursor() as cur:
            await cur.execute(
                cls._select_base + " ORDER BY id ASC LIMIT %s OFFSET %s",
                (lim, off),
            )
            rows = await cur.fetchall()
        return [cls._row_to_model(r) for r in rows]

    @classmethod
    async def update(
        cls,
        conn: AsyncConnection,
        config_id: int,
        *,
        services_offered: list[Any] | None = None,
        budget_slider_config: dict[str, Any] | None = None,
        ui_options: dict[str, Any] | None = None,
    ) -> AdminSiteConfig | None:
        fields: list[str] = []
        values: list[Any] = []
        if services_offered is not None:
            fields.append("services_offered = %s")
            values.append(Json(services_offered))
        if budget_slider_config is not None:
            fields.append("budget_slider_config = %s")
            values.append(Json(budget_slider_config))
        if ui_options is not None:
            fields.append("ui_options = %s")
            values.append(Json(ui_options))
        if not fields:
            return await cls.get_by_id(conn, config_id)
        values.append(config_id)
        async with conn.cursor() as cur:
            await cur.execute(
                f"""
                UPDATE site_admin_config
                SET {", ".join(fields)}, updated_at = now()
                WHERE id = %s
                """,
                values,
            )
        await conn.commit()
        return await cls.get_by_id(conn, config_id)

    @classmethod
    async def delete(cls, conn: AsyncConnection, config_id: int) -> bool:
        async with conn.cursor() as cur:
            await cur.execute("DELETE FROM site_admin_config WHERE id = %s", (config_id,))
            deleted = cur.rowcount
        await conn.commit()
        return deleted > 0
