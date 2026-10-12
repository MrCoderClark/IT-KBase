"""Structured logging via structlog, emitting JSON lines.

Named `telemetry` rather than `logging` to avoid shadowing the stdlib
module when imported from inside this package. OpenTelemetry traces /
metrics will land here too (see Docs/specs/01-architecture.md §7).

Call `configure_logging(level)` once at app startup, before any logger
is used in anger. Prefer the structlog logger via `get_logger(__name__)`.
"""

from __future__ import annotations

import logging
import sys

import structlog


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


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a structlog bound logger. Pass `__name__` from callers."""
    return structlog.get_logger(name)
