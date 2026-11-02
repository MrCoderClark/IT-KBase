"""OpenTelemetry ingest spans and W3C propagation."""

from __future__ import annotations

import logging
from collections.abc import Iterator

import anyio
import pytest
from opentelemetry import trace
from opentelemetry.context import attach, detach
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from starlette.concurrency import iterate_in_threadpool

from backend.progress import StageClock
from backend.telemetry import extract_context, inject_context, iter_with_context


def _memory_exporter() -> InMemorySpanExporter:
    """Attach an in-memory exporter to the process TracerProvider.

    OpenTelemetry refuses to replace a provider once set (app fixtures often
    install one first), so tests add a processor instead of calling
    ``set_tracer_provider`` again.
    """
    exporter = InMemorySpanExporter()
    current = trace.get_tracer_provider()
    if isinstance(current, TracerProvider):
        current.add_span_processor(SimpleSpanProcessor(exporter))
        return exporter

    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return exporter


def test_stage_clock_emits_named_spans() -> None:
    exporter = _memory_exporter()
    clock = StageClock("job-1")
    clock.start("parsing", detail="Reading")
    clock.finish("parsing", "succeeded", detail="ok")
    clock.start("validating", detail="Checking")
    clock.finish("validating", "failed", detail="empty")

    spans = [span for span in exporter.get_finished_spans() if span.name.startswith("ingest.")]
    names = [span.name for span in spans]
    assert names == ["ingest.parsing", "ingest.validating"]
    assert spans[0].attributes["tb.job_id"] == "job-1"
    assert spans[0].attributes["tb.stage.status"] == "succeeded"
    assert spans[1].status.status_code == trace.StatusCode.ERROR


def test_inject_extract_roundtrip_preserves_trace_id() -> None:
    _memory_exporter()
    tracer = trace.get_tracer("test")
    with tracer.start_as_current_span("parent") as span:
        carrier: dict[str, str] = {}
        inject_context(carrier)
        assert "traceparent" in carrier
        child_ctx = extract_context(carrier)
        with tracer.start_as_current_span("child", context=child_ctx) as child:
            assert child.get_span_context().trace_id == span.get_span_context().trace_id


def _drain_like_streaming_response(gen: Iterator[str]) -> list[str]:
    """Consume ``gen`` the way StreamingResponse consumes a sync iterator."""

    async def main() -> list[str]:
        return [item async for item in iterate_in_threadpool(gen)]

    return anyio.run(main)


def test_attach_across_yields_fails_under_threadpool(caplog: pytest.LogCaptureFixture) -> None:
    """Reproduces the /ingest SSE bug: attach before the yields, detach after."""
    _memory_exporter()
    job = trace.get_tracer("test").start_span("ingest.job")

    def naive() -> Iterator[str]:
        token = attach(trace.set_span_in_context(job))
        try:
            yield "progress"
            yield "done"
        finally:
            detach(token)

    with caplog.at_level(logging.ERROR, logger="opentelemetry.context"):
        _drain_like_streaming_response(naive())
    job.end()

    assert "Failed to detach context" in caplog.text


def test_iter_with_context_survives_threadpool_and_parents_spans(
    caplog: pytest.LogCaptureFixture,
) -> None:
    exporter = _memory_exporter()
    tracer = trace.get_tracer("test")
    job = tracer.start_span("ingest.job")

    def stages() -> Iterator[str]:
        for name in ("ingest.parsing", "ingest.extracting"):
            tracer.start_span(name).end()
            yield name

    with caplog.at_level(logging.ERROR, logger="opentelemetry.context"):
        out = _drain_like_streaming_response(
            iter_with_context(stages(), trace.set_span_in_context(job))
        )
    job.end()

    assert out == ["ingest.parsing", "ingest.extracting"]
    assert "Failed to detach context" not in caplog.text
    job_span_id = job.get_span_context().span_id
    children = [s for s in exporter.get_finished_spans() if s.name in out]
    assert len(children) == 2
    assert all(s.parent is not None and s.parent.span_id == job_span_id for s in children)
