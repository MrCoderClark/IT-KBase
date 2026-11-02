"""OpenTelemetry ingest spans and W3C propagation."""

from __future__ import annotations

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from backend.progress import StageClock
from backend.telemetry import extract_context, inject_context


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
