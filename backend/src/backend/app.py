"""FastAPI application factory.

Expose both a factory (`create_app()`) for tests / alt entrypoints and
a module-level `app` for uvicorn (`uvicorn backend.app:app`).

Keep this file thin: wire routers, middleware, lifespan, and nothing
business-logic-heavy. Routers live under `backend.api.*`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.api.health import router as health_router
from backend.config import get_settings
from backend.telemetry import configure_logging, get_logger

log = get_logger(__name__)


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    log.info(
        "service.startup",
        service=settings.service_name,
        version=settings.service_version,
        env=settings.env,
    )
    yield
    log.info("service.shutdown", service=settings.service_name)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="TechBase Ingestion",
        description=(
            "Parses Word/PDF uploads into structured knowledge articles. "
            "See Docs/specs/05-ai-ingestion.md and Docs/specs/06-api.md."
        ),
        version=settings.service_version,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.docs_enabled else None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        lifespan=_lifespan,
    )

    app.include_router(health_router)

    return app


app = create_app()
