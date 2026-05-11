"""Пул асинхронных подключений к PostgreSQL (только из backend; URL задаётся compose)."""

from collections.abc import AsyncGenerator

from fastapi import Request
from psycopg import AsyncConnection
from psycopg_pool import AsyncConnectionPool

from app.settings import settings


async def create_pool() -> AsyncConnectionPool:
    pool = AsyncConnectionPool(
        conninfo=settings.database_url,
        min_size=1,
        max_size=10,
        open=False,
        kwargs={"autocommit": False},
    )
    await pool.open()
    return pool


async def close_pool(pool: AsyncConnectionPool | None) -> None:
    if pool is not None:
        await pool.close()


async def get_db_conn(request: Request) -> AsyncGenerator[AsyncConnection, None]:
    pool: AsyncConnectionPool = request.app.state.db_pool
    async with pool.connection() as conn:
        yield conn
