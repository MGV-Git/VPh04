from dataclasses import dataclass
from datetime import datetime
from typing import Any

from psycopg import AsyncConnection


@dataclass(slots=True)
class AdminUser:
    id: int
    created_at: datetime
    updated_at: datetime
    login: str
    password_hash: str


class AdminUserCRUD:
    _select_base = """
        SELECT id, created_at, updated_at, login, password_hash
        FROM admin_users
    """

    @classmethod
    def _row_to_model(cls, row: Any) -> AdminUser:
        return AdminUser(
            id=row[0],
            created_at=row[1],
            updated_at=row[2],
            login=row[3],
            password_hash=row[4],
        )

    @classmethod
    async def create(cls, conn: AsyncConnection, *, login: str, password_hash: str) -> int:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO admin_users (login, password_hash)
                VALUES (%s, %s)
                RETURNING id
                """,
                (login, password_hash),
            )
            row = await cur.fetchone()
        await conn.commit()
        return int(row[0])

    @classmethod
    async def get_by_id(cls, conn: AsyncConnection, admin_id: int) -> AdminUser | None:
        async with conn.cursor() as cur:
            await cur.execute(cls._select_base + " WHERE id = %s", (admin_id,))
            row = await cur.fetchone()
        if row is None:
            return None
        return cls._row_to_model(row)

    @classmethod
    async def get_by_login(cls, conn: AsyncConnection, login: str) -> AdminUser | None:
        async with conn.cursor() as cur:
            await cur.execute(cls._select_base + " WHERE login = %s", (login,))
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
    ) -> list[AdminUser]:
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
        admin_id: int,
        *,
        login: str | None = None,
        password_hash: str | None = None,
    ) -> AdminUser | None:
        fields: list[str] = []
        values: list[Any] = []
        if login is not None:
            fields.append("login = %s")
            values.append(login)
        if password_hash is not None:
            fields.append("password_hash = %s")
            values.append(password_hash)
        if not fields:
            return await cls.get_by_id(conn, admin_id)
        values.append(admin_id)
        async with conn.cursor() as cur:
            await cur.execute(
                f"""
                UPDATE admin_users
                SET {", ".join(fields)}, updated_at = now()
                WHERE id = %s
                """,
                values,
            )
        await conn.commit()
        return await cls.get_by_id(conn, admin_id)

    @classmethod
    async def delete(cls, conn: AsyncConnection, admin_id: int) -> bool:
        async with conn.cursor() as cur:
            await cur.execute("DELETE FROM admin_users WHERE id = %s", (admin_id,))
            deleted = cur.rowcount
            if deleted > 0:
                await cur.execute("SELECT count(*) FROM admin_users")
                cnt_row = await cur.fetchone()
                if cnt_row is not None and int(cnt_row[0]) == 0:
                    await cur.execute(
                        "SELECT setval(pg_get_serial_sequence('admin_users', 'id'), 1, false)"
                    )
        await conn.commit()
        return deleted > 0

    @classmethod
    async def count(cls, conn: AsyncConnection) -> int:
        async with conn.cursor() as cur:
            await cur.execute("SELECT count(*) FROM admin_users")
            row = await cur.fetchone()
        return int(row[0]) if row else 0
