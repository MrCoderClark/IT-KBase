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
from opentelemetry.context import attach, detach
from starlette.types import ASGIApp, Receive, Scope, Send

from auth_py import parse_assertion_keys, require_principal
from backend.api.health import router as health_router
from backend.api.ingest import build_ingest_router
from backend.api.parse import build_parse_router
from backend.api.principal import build_principal_router
from backend.config import get_settings
from backend.storage import StorageError, ensure_local_upload_cors
from backend.telemetry import (
    configure_logging,
    configure_tracing,
    extract_context,
    get_logger,
)

log = get_logger(__name__)


class TraceContextMiddleware:
    """Extract W3C ``traceparent`` from inbound headers and activate it for the request.

    Must be a pure ASGI middleware rather than a ``BaseHTTPMiddleware`` subclass:
    ``BaseHTTPMiddleware`` wraps the inner request in a child asyncio task via
    anyio's ``TaskGroup``, and OpenTelemetry's ``attach``/``detach`` tokens are
    scoped to the task that produced them. Running ``detach`` in the child's
    context raises ``ValueError: Token ... was created in a different Context``.
    Pure ASGI keeps the whole request in a single asyncio context so detach
    works and ingest spans nest cleanly under the caller's trace.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {
            k.decode("latin-1").lower(): v.decode("latin-1")
            for k, v in scope.get("headers", [])
        }
        token = attach(extract_context(headers))
        try:
            await self.app(scope, receive, send)
        finally:
            detach(token)


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    exporting = configure_tracing(
        service_name=settings.service_name,
        service_version=settings.service_version,
    )
    log.info("service.tracing", exporter="otlp" if exporting else "local")
    log.info(
        "service.startup",
        service=settings.service_name,
        version=settings.service_version,
        env=settings.env,
    )
    if settings.is_local:
        try:
            ensure_local_upload_cors()
            log.info("storage.cors.ready", origins="localhost:3000/3001")
        except StorageError as exc:
            log.warning("storage.cors.skipped", reason=str(exc))
        except Exception as exc:  # SeaweedFS down or old build without PutBucketCors
            log.warning("storage.cors.failed", error=str(exc))
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
    app.add_middleware(TraceContextMiddleware)

    app.include_router(health_router)
    keys = parse_assertion_keys(settings.assertion_keys)
    service_tokens = {item.strip() for item in settings.service_tokens.split(",") if item.strip()}
    principal = require_principal(keys, service_tokens)
    app.include_router(build_principal_router(principal))
    app.include_router(build_parse_router(principal))
    app.include_router(build_ingest_router(principal))

    return app


app = create_app()
