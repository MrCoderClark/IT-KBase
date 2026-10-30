# 16 — Load (article detail + ingest)

> Gate for suggested-order item 31. Roadmap M7 lists **1k rps** on article detail and **100 concurrent** ingestions (`08-roadmap.md`).

## What we measure

| Scenario | Gate (local) | Roadmap / later |
|----------|--------------|-----------------|
| **Article detail** | SSR health: error rate &lt; 1%, p99 ≤ 5s, RPS ≥ **15** over 30s at 50 connections | **1000** rps needs edge/CDN or a fully cached public HTML path — not a single Node SSR process |
| **Ingest** | **100** concurrent `POST /ingest` all **200**, wall &lt; 180s | Same |

Default article path: `/kb/windows-11-resetting-local-administrator-password` (seeded `visibility: public`).

Why the local RPS floor is ~15, not 1000: a cold public article still hits Postgres + React SSR. A laptop run measured ~22 rps at 200 connections with rising p99. The script still prints RPS so we can watch for regressions; raising `LOAD_ARTICLE_MIN_RPS` to `1000` is the staging/CDN check.

## Commands (PowerShell)

### Article detail (from `frontend/`)

Production CSS requires the PostCSS Tailwind plugin (webpack build). Dev uses Turbopack and does not need it.

```powershell
cd frontend
pnpm add -D @tailwindcss/postcss postcss

# Terminal A — production server (styles must match `pnpm dev`)
pnpm build
pnpm start

# Terminal B — local SSR health gate
pnpm test:load:article
```

Overrides:

| Variable | Default (local gate) |
|----------|----------------------|
| `LOAD_ARTICLE_BASE_URL` | `http://127.0.0.1:3000` |
| `LOAD_ARTICLE_PATH` | `/kb/windows-11-resetting-local-administrator-password` |
| `LOAD_ARTICLE_DURATION_S` | `30` |
| `LOAD_ARTICLE_CONNECTIONS` | `50` |
| `LOAD_ARTICLE_MIN_RPS` | `15` |
| `LOAD_ARTICLE_MAX_ERROR_RATE` | `0.01` |
| `LOAD_ARTICLE_MAX_P99_MS` | `5000` |

Roadmap check (only when a cache/CDN sits in front): `$env:LOAD_ARTICLE_MIN_RPS = "1000"`.

### Ingest (from `backend/`)

Start FastAPI with **object storage configured** and **no LLM** (empty `AI_API_KEY`):

```powershell
cd backend

# Terminal A
$env:AI_API_KEY = ""
uv run backend

# Terminal B — uses TB_ASSERTION_KEYS + TB_S3_* from .env
uv run python scripts/load_ingest.py
```

The script: builds a tiny `.docx` → `presign` → S3 PUT once → **100** parallel `POST /ingest` (unique `jobId`, shared object key). Assertions are reminted often (60s TTL).

| Variable | Default |
|----------|---------|
| `LOAD_INGEST_BASE_URL` | `http://127.0.0.1:8080` |
| `LOAD_INGEST_CONCURRENCY` | `100` |
| `LOAD_INGEST_TIMEOUT_S` | `120` |
| `LOAD_INGEST_MAX_WALL_S` | `180` |
| `LOAD_INGEST_UID` | `load-user` |
| `TB_ASSERTION_KEYS` | required (`kid:secret`, same as the running service) |

## Pass / fail

- Article script exits **0** only if RPS, error rate, and p99 all meet the thresholds.
- Ingest script exits **0** only if every job returns HTTP 200 with a draft, within the wall budget.

## When a gate fails

1. Article: confirm public slug (not `/login`), prefer `pnpm start` after `pnpm build`, and that Tailwind utilities are present (view-source / DevTools → styles). Missing utilities usually means `@tailwindcss/postcss` was not installed before `pnpm build`.
2. Ingest: confirm SeaweedFS/MinIO up, `AI_API_KEY` empty on the **running** process, assertion kid matches `TB_ASSERTION_KEYS`, and `/healthz` is green. Mass `401 Invalid bearer token` under concurrency usually means the server blocked the event loop before auth ran (fixed by `asyncio.to_thread` on `POST /ingest`) or assertions expired while a sync parse held the loop — restart backend after pulling that fix.
