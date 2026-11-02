# Local OpenTelemetry (Tempo + Grafana)

M7 observability for ingest traces. Apps already emit OTLP when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set (`feat/ingest-otel`). This stack
receives those spans and shows them in Grafana.

| Service | URL / port |
|---------|------------|
| OTLP HTTP (apps) | `http://127.0.0.1:4318` |
| Tempo query API | `http://127.0.0.1:3200` |
| Grafana | [http://127.0.0.1:3300](http://127.0.0.1:3300) — `admin` / `admin` |

Dashboard: **TechBase → TechBase — Ingest traces**

Prometheus golden-signal metrics and a CDN 1k rps path stay separate follow-ups.

## Start

From the repo root (Docker Desktop / Engine running):

```powershell
docker compose -f infra/otel/docker-compose.yml up -d
docker compose -f infra/otel/docker-compose.yml ps
```

Stop:

```powershell
docker compose -f infra/otel/docker-compose.yml down
```

## Point the apps at Tempo

Add to `backend/.env` and `frontend/.env` (and restart FastAPI + `pnpm worker:ingest`):

```powershell
$env:OTEL_EXPORTER_OTLP_ENDPOINT = "http://127.0.0.1:4318"
```

Or persist in each `.env`:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
```

Without the variable, spans stay local (no export) — same as before.

## Smoke

1. Start Tempo/Grafana (compose above).
2. Restart ingestion (`uv run` FastAPI) and `pnpm worker:ingest` with the env set.
3. Import a Word/PDF once.
4. Open Grafana → **TechBase — Ingest traces** (or Explore → Tempo → TraceQL).
5. Confirm linked spans: `ingest.enqueue` / `ingest.run` (web) and `ingest.job` / `ingest.parsing` … (Python), same `trace_id`.

## Layout

```
infra/otel/
├─ docker-compose.yml
├─ tempo.yaml
├─ README.md
└─ grafana/
   ├─ provisioning/datasources/tempo.yaml
   ├─ provisioning/dashboards/dashboards.yaml
   └─ dashboards/ingest-traces.json
```
