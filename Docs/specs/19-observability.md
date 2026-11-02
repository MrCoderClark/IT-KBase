# 19 — Observability (M7 traces → Grafana/Tempo)

> Local gate for ingest OpenTelemetry. Spans ship from `feat/ingest-otel`; this
> doc is the collector + dashboard path.

## What is in scope

| Signal | Status |
|--------|--------|
| Structured JSON logs (FastAPI structlog) | ✅ |
| Ingest W3C `traceparent` Next → BullMQ → FastAPI | ✅ |
| Stage spans `ingest.{enqueue,run,job,parsing,…}` | ✅ |
| OTLP export when `OTEL_EXPORTER_OTLP_ENDPOINT` is set | ✅ |
| Local Tempo + Grafana for those traces | ✅ `infra/otel/` |
| Prometheus golden signals / metrics scrape | ⬜ later |
| Article-detail 1k rps (CDN/cache) | ⬜ see `16-load.md` |

## Local stack

See [`infra/otel/README.md`](../../infra/otel/README.md).

```powershell
docker compose -f infra/otel/docker-compose.yml up -d
# apps:
# OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
```

Grafana: `http://127.0.0.1:3300` — dashboard **TechBase — Ingest traces**.

## Services

| `service.name` | Process |
|----------------|---------|
| `techbase-ingestion` | FastAPI |
| `techbase-web-ingest` | Next ingest worker / BFF enqueue |

Useful span attributes: `tb.job_id`, `tb.stage`, `tb.outcome`, `tb.file_name`.

## Done when

- [ ] `docker compose -f infra/otel/docker-compose.yml up -d` stays healthy
- [ ] One import with OTLP set shows a linked web + Python trace in Grafana
- [ ] Failed parse / storage errors appear under the error TraceQL panel
