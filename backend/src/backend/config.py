"""Runtime configuration — loaded from environment at boot, fail-fast.

All env vars are prefixed `TB_` (TechBase) to avoid collisions. Example:

    TB_ENV=local
    TB_LOG_LEVEL=INFO
    TB_PORT=8080

A `.env` file in the current working directory is read in dev; in prod,
rely on real env vars from the orchestrator. Missing or malformed values
raise at import time via `get_settings()` — never silently default to
something unsafe for a prod-only setting.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TB_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Service identity
    service_name: str = "techbase-ingestion"
    service_version: str = "0.1.0"

    # Environment
    env: Literal["local", "preview", "staging", "prod"] = "local"

    # HTTP server
    host: str = "127.0.0.1"
    port: int = Field(default=8080, ge=1, le=65535)
    reload: bool = False  # overridden by `main()` in dev

    # Observability
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    # API surface
    docs_enabled: bool = True  # /docs + /redoc exposure

    # Auth assertions minted by Next.js. `kid:secret,kid2:secret`. Empty disables user calls.
    assertion_keys: str = ""
    # Comma-separated `sv_...` credentials for background jobs.
    service_tokens: str = ""

    @property
    def is_local(self) -> bool:
        return self.env == "local"

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a process-wide cached Settings instance."""
    return Settings()  # type: ignore[call-arg]
