"""Liveness and readiness endpoints.

- `/healthz` — the process is up. Should never block on dependencies;
  used by orchestrators to decide whether to restart the container.
- `/readyz` — the process is ready to serve traffic. Will later check
  Redis, S3, and the LLM provider's reachability; for now it returns
  ready unconditionally so we have a stable contract.

Spec: Docs/specs/06-api.md §4.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.config import Settings, get_settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok", "ready", "degraded"]
    service: str
    version: str
    env: str
    time: datetime = Field(description="Server time, ISO 8601 UTC")


def _snapshot(settings: Settings, status: Literal["ok", "ready", "degraded"]) -> HealthResponse:
    return HealthResponse(
        status=status,
        service=settings.service_name,
        version=settings.service_version,
        env=settings.env,
        time=datetime.now(UTC),
    )


@router.get("/healthz", summary="Liveness probe")
async def healthz() -> HealthResponse:
    """Return `ok` as long as the process can handle a request."""
    return _snapshot(get_settings(), "ok")


@router.get("/readyz", summary="Readiness probe")
async def readyz() -> HealthResponse:
    """Return `ready` once downstream dependencies are reachable.

    TODO (M3+): check Redis + S3 + configured LLM provider before
    reporting ready. Degrade with a 503 and `status="degraded"` if any
    dependency is unreachable.
    """
    return _snapshot(get_settings(), "ready")
