"""
Application configuration — loaded from environment variables / .env file.
Uses pydantic-settings for strict, typed config with validation.
"""

from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the StayFinder backend."""

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Gemini / AI ──────────────────────────────────────────────────
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"

    # ── Database ─────────────────────────────────────────────────────
    database_path: str = "data/PS-02.db"

    # ── Server ───────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
    debug: bool = False

    # ── Derived ──────────────────────────────────────────────────────
    @property
    def db_abs_path(self) -> str:
        """Resolve DB path relative to the backend/ directory."""
        base = Path(__file__).resolve().parent.parent  # backend/
        cand = base / self.database_path
        if cand.exists():
            return str(cand.resolve())
        data_cand = base / "data" / "PS-02.db"
        if data_cand.exists():
            return str(data_cand.resolve())
        return str((base / ".." / "PS-02.db").resolve())

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ai_available(self) -> bool:
        """Check if Gemini API key is configured."""
        return bool(self.gemini_api_key)


@lru_cache
def get_settings() -> Settings:
    """Singleton accessor — cached after first call."""
    return Settings()
