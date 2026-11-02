"""Structured logging + optional OpenTelemetry traces.

Named `telemetry` rather than `logging` to avoid shadowing the stdlib
module when imported from inside this package.

Logging always emits JSON lines. Tracing is off unless
`OTEL_EXPORTER_OTLP_ENDPOINT` is set (or a test installs an exporter via
`configure_tracing`). See Docs/specs/01-architecture.md §7.
"""

from __future__ import annotations

import logging
import os
import sys
from collections.abc import Mapping

import structlog
from opentelemetry import propagate, trace
from opentelemetry.context import Context
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter
from opentelemetry.trace import Tracer

_SERVICE = "techbase-ingestion"
_configured = False


def configure_logging(level: str = "INFO") -> None:
    """Configure stdlib + structlog to emit JSON to stdout."""
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    # Stdlib root logger — JSON formatting is delegated to structlog's
    # ProcessorFormatter so third-party libs that use `logging` emit the
    # same shape as our own loggers.
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=numeric_level,
    )

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(numeric_level),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def configure_tracing(
    *,
    service_name: str = _SERVICE,
    service_version: str = "0.1.0",
    exporter: SpanExporter | None = None,
    endpoint: str | None = None,
) -> bool:
    """Install a TracerProvider so ingest spans nest under W3C parents.

    Returns True when an OTLP (or test) exporter is attached. Without an
    exporter, spans still get real IDs for propagation but are not exported.
    Safe to call more than once; later calls are no-ops unless ``exporter``
    is passed (tests).
    """
    global _configured

    if _configured and exporter is None:
        return bool(os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip())

    resolved_endpoint = (
        endpoint
        if endpoint is not None
        else os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "")
    ).strip()
    active_exporter = exporter
    if active_exporter is None and resolved_endpoint:
        # OTLP HTTP expects the traces path; accept bare collector base URL.
        url = resolved_endpoint.rstrip("/")
        if not url.endswith("/v1/traces"):
            url = f"{url}/v1/traces"
        active_exporter = OTLPSpanExporter(endpoint=url)

    resource = Resource.create(
        {
            "service.name": service_name,
            "service.version": service_version,
        }
    )
    provider = TracerProvider(resource=resource)
    if active_exporter is not None:
        provider.add_span_processor(BatchSpanProcessor(active_exporter))
    trace.set_tracer_provider(provider)
    _configured = True
    return active_exporter is not None


def tracing_enabled() -> bool:
    return _configured


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a structlog bound logger. Pass `__name__` from callers."""
    return structlog.get_logger(name)


def get_tracer(name: str = _SERVICE) -> Tracer:
    return trace.get_tracer(name)


def extract_context(carrier: Mapping[str, str] | None) -> Context:
    """Restore context from W3C ``traceparent`` / ``tracestate`` headers."""
    if not carrier:
        return Context()
    normalized = {str(k).lower(): str(v) for k, v in carrier.items() if v}
    return propagate.extract(normalized)


def inject_context(carrier: dict[str, str], ctx: Context | None = None) -> dict[str, str]:
    """Write W3C trace headers into ``carrier`` (mutates and returns it)."""
    propagate.inject(carrier, context=ctx)
    return carrier
