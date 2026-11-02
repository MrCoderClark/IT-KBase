import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { context, trace } from "@opentelemetry/api";
import {
  contextFromCarrier,
  ensureIngestOtel,
  injectTraceCarrier,
  injectTraceHeaders,
  withIngestSpan,
} from "@/lib/otel/ingest";

describe("ingest otel propagation", () => {
  it("injects traceparent from an active span", async () => {
    ensureIngestOtel();
    await withIngestSpan("ingest.test", { "tb.job_id": "j1" }, async () => {
      const carrier = injectTraceCarrier();
      assert.ok(carrier.traceparent);
      assert.match(carrier.traceparent!, /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);

      const headers = injectTraceHeaders({ Accept: "text/event-stream" });
      assert.equal(headers.Accept, "text/event-stream");
      assert.ok(headers.traceparent);

      const childCtx = contextFromCarrier(carrier);
      const parentSpan = trace.getSpan(context.active());
      assert.ok(parentSpan);
      const childSpan = trace.getTracer("test").startSpan("child", undefined, childCtx);
      assert.equal(childSpan.spanContext().traceId, parentSpan.spanContext().traceId);
      childSpan.end();
    });
  });
});
