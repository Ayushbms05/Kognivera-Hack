"""
Async SQLite connection manager.

Uses aiosqlite with WAL mode and row-factory for dict results.
Provides a FastAPI dependency `get_db()` that yields a connection per request.
"""

from __future__ import annotations

import aiosqlite
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from core.config import get_settings

# ── Globals ──────────────────────────────────────────────────────────
_db_path: str | None = None


def _row_factory(cursor: aiosqlite.Cursor, row: tuple) -> dict:
    """Convert each row into a dict keyed by column name."""
    columns = [d[0] for d in cursor.description]
    return dict(zip(columns, row))


async def init_db() -> None:
    """Called once at startup — enables WAL mode and sets pragmas."""
    global _db_path
    settings = get_settings()
    _db_path = settings.db_abs_path

    async with aiosqlite.connect(_db_path) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA foreign_keys=ON")
        await db.execute("PRAGMA busy_timeout=5000")
        await db.commit()


async def close_db() -> None:
    """Called once at shutdown — nothing to clean with aiosqlite per-request model."""
    pass


@asynccontextmanager
async def get_db_conn() -> AsyncGenerator[aiosqlite.Connection, None]:
    """Context manager for obtaining a DB connection with dict rows."""
    assert _db_path is not None, "Database not initialised — call init_db() first"
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = _row_factory
        yield db


async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    """FastAPI dependency — yields a connection, auto-closes after request."""
    async with get_db_conn() as db:
        yield db
