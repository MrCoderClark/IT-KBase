/**
 * Optional OpenTelemetry for the ingest path.
 * When OTEL_EXPORTER_OTLP_ENDPOINT is unset, spans stay local (no export).
 * W3C traceparent still propagates Next → BullMQ → FastAPI.
 */

import {
  context,
  propagation,
  SpanStatusCode,
  trace,
  type Context,
  type Span,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

const SERVICE = "techbase-web-ingest";
let ready = false;

function otlpTracesUrl(endpoint: string): string {
  const base = endpoint.replace(/\/$/, "");
  return base.endsWith("/v1/traces") ? base : `${base}/v1/traces`;
}

/** Register a tracer provider once per process (worker or Next runtime). */
export function ensureIngestOtel(): void {
  if (ready) return;
  ready = true;
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  const endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "").trim();
  const spanProcessors = endpoint
    ? [new BatchSpanProcessor(new OTLPTraceExporter({ url: otlpTracesUrl(endpoint) }))]
    : [];

  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({
      "service.name": SERVICE,
      "service.version": "0.1.0",
    }),
    spanProcessors,
  });

  trace.setGlobalTracerProvider(provider);
}

export function ingestTracer() {
  ensureIngestOtel();
  return trace.getTracer(SERVICE);
}

export type TraceCarrier = {
  traceparent?: string;
  tracestate?: string;
};

export function injectTraceCarrier(ctx?: Context): TraceCarrier {
  ensureIngestOtel();
  const carrier: Record<string, string> = {};
  propagation.inject(ctx ?? context.active(), carrier);
  return {
    traceparent: carrier.traceparent,
    tracestate: carrier.tracestate,
  };
}

export function contextFromCarrier(carrier: TraceCarrier | null | undefined): Context {
  ensureIngestOtel();
  if (!carrier?.traceparent) return context.active();
  const headers: Record<string, string> = { traceparent: carrier.traceparent };
  if (carrier.tracestate) headers.tracestate = carrier.tracestate;
  return propagation.extract(context.active(), headers);
}

export function injectTraceHeaders(
  headers: Record<string, string>,
  ctx?: Context,
): Record<string, string> {
  ensureIngestOtel();
  const carrier: Record<string, string> = {};
  propagation.inject(ctx ?? context.active(), carrier);
  if (carrier.traceparent) headers.traceparent = carrier.traceparent;
  if (carrier.tracestate) headers.tracestate = carrier.tracestate;
  return headers;
}

export async function withIngestSpan<T>(
  name: string,
  attrs: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>,
  parent?: Context,
): Promise<T> {
  const tracer = ingestTracer();
  const span = tracer.startSpan(name, { attributes: attrs }, parent);
  const ctx = trace.setSpan(parent ?? context.active(), span);
  try {
    return await context.with(ctx, () => fn(span));
  } catch (err) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    span.end();
  }
}
