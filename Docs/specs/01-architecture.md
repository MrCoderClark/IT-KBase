# 01 — Architecture

## 1. System diagram

```
                       ┌───────────────────────────────────────┐
                       │              Browser (SPA/SSR)        │
                       │  Next.js 15 · Tailwind v4 · shadcn    │
                       └───────────────┬───────────────────────┘
                                       │ HTTPS
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Next.js server (Vercel / Node)            │
│  ├─ RSC + Server Actions                                     │
│  ├─ Opaque session cookie (ADR 0001)                        │
│  ├─ API routes: /api/articles, /api/upload, /api/search      │
│  ├─ Edge: static article HTML cache                          │
│  └─ Clients: Prisma (Postgres), ioredis, S3, Ingestion API   │
└───┬───────────────────┬──────────────────────┬───────────────┘
    │                   │                      │
    │ SQL              │ Redis                 │ HTTPS
    ▼                   ▼                      ▼
┌─────────┐      ┌───────────────┐   ┌──────────────────────────┐
│ Postgres│      │     Redis     │   │ Python Ingestion Service │
│ (Neon/  │      │  cache ·      │   │  FastAPI · uv · pydantic │
│  RDS)   │      │  sessions ·   │   │  python-docx · pdfplumber│
└─────────┘      │  BullMQ queue │   │  unstructured (fallback) │
                 │  pub/sub      │   │  LLM extractor (pluggable)│
                 └──────┬────────┘   └──────────┬───────────────┘
                        │ streams              │
                        └──────────┬───────────┘
                                   ▼
                           ┌───────────────┐
                           │  Object store │
                           │ (S3 / MinIO)  │
                           └───────────────┘
```

## 2. Services

### 2.1 `apps/web` — Next.js 15

Responsibilities:

- All UI, authoring, read view, search, admin.
- Thin orchestration: calls Prisma for data, Redis for cache/queue, Python service for ingestion.
- **Does not** parse PDFs, run LLMs, or do heavy CPU work.

Key routes (App Router):

```
app/
  (marketing)/
  (app)/
    layout.tsx                 # dark sidebar + light canvas shell
    home/page.tsx
    kb/
      page.tsx                 # All Articles
      drafts/page.tsx
      shared/page.tsx
      recent/page.tsx
      [slug]/page.tsx          # Article detail (the mock view)
      [slug]/edit/page.tsx
    create/page.tsx
    categories/page.tsx
    tags/page.tsx
    import/page.tsx            # Upload DOCX/PDF
    analytics/page.tsx
    admin/
      users/page.tsx
      settings/page.tsx
      integrations/page.tsx
  api/
    articles/route.ts
    upload/route.ts            # presigned S3 + /ingest kickoff
    search/route.ts
    jobs/[id]/stream/route.ts  # SSE proxy to Redis
    auth/                      # login, logout, reset (auth/web)
```

### 2.2 `services/ingestion` — Python 3.12 + FastAPI

Responsibilities:

- Receive upload metadata, pull source file from S3.
- Parse → segment → extract → structure → validate.
- Persist a **draft article** via REST callback to Next.js.
- Emit progress events to Redis streams.

Rationale for Python (vs Node): the DOCX/PDF ecosystem — `python-docx`, `pdfplumber`, `unstructured`, `pypandoc`, `camelot` for tables — is years ahead of anything in Node. We take the operational cost of a second service to get that.

### 2.3 Postgres

- Primary store. Access via Prisma from Next.js only. Auth tables live in the `auth` schema; article tables stay in the app schema.
- Python service does **not** touch Postgres directly. User-triggered calls carry a 60-second HMAC assertion minted by Next.js. Background jobs call back with a scoped service token. See [ADR 0001](adr/0001-server-managed-sessions.md).

Rationale: keeps schema ownership in one place and avoids two-sided migrations.

### 2.4 Redis

Three roles, one dependency:

| Role      | Keys / channels                          | Notes                            |
|-----------|------------------------------------------|----------------------------------|
| Cache     | `article:{id}` (JSON), `search:{hash}`   | TTL 5m for article, 1m for search |
| Sessions  | —                                        | Postgres `auth.session`, not Redis |
| Queue     | BullMQ queue `ingest`                    | Jobs enqueued by Next.js         |
| Streams   | `jobs:{id}:events`                       | Progress events for SSE          |
| HLL       | `views:{articleId}:{yyyymmdd}`           | Unique view counting             |

### 2.5 Object storage (S3-compatible)

- Buckets: `uploads/` (raw user files), `assets/` (hero images, exports), `exports/` (generated PDFs).
- Presigned PUT for uploads, presigned GET for private assets.
- MinIO in local dev.

## 3. Data flow — ingestion

1. User drops a DOCX in the Import page.
2. Next.js requests a presigned PUT, client uploads directly to S3.
3. Client calls `POST /api/upload/complete` with the S3 key.
4. Next.js creates an `IngestionJob` row (`status=queued`), enqueues BullMQ `ingest` job.
5. Python service (worker) picks up the job, downloads from S3.
6. Pipeline runs: parse → segment → extract → structure → validate. Each stage pushes an event to `jobs:{id}:events` (Redis stream).
7. Client holds an SSE connection to `/api/jobs/{id}/stream`, which proxies the Redis stream.
8. On success, Python calls `POST /api/internal/articles` with the structured draft (service-token auth).
9. Next.js persists the draft, returns the article id.
10. Python emits a final `done` event with the slug; UI navigates to the draft.

## 4. Data flow — read

1. Request to `/kb/{slug}` hits Next.js.
2. RSC fetches `getArticle(slug)` — tries Redis `article:{id}` first, falls back to Postgres.
3. HTML streams to the browser. Right rail (Related Articles) is a separate suspense boundary — doesn't block TTFB.
4. Client component hydrates: TOC scroll-spy, keyboard shortcuts, feedback widget.
5. View is recorded: `POST /api/articles/{id}/view` (fire-and-forget) → Redis HLL + Postgres counter batched hourly.

## 5. Rendering strategy

| Route                      | Strategy                                       |
|----------------------------|------------------------------------------------|
| `/kb/[slug]` (published, private) | SSR, session required                    |
| `/kb/[slug]` (published, public)  | SSR, readable without a session          |
| `/kb/[slug]/edit`          | SSR, session and role required                  |
| `/kb` (list)               | SSR, session required                           |
| Search results             | Server Action, session required                 |
| Admin pages                | SSR, role-gated                                 |

## 6. Caching

- **Article HTML**: cached at the edge, invalidated by tag on publish/unpublish/update.
- **Article JSON**: Redis, 5min TTL; invalidated by tag on write.
- **Search results**: Redis, 60s TTL; keyed by normalized query + filters.
- **Static assets**: immutable, hashed filenames.

## 7. Observability

- **Logs**: structured JSON. Fields: `ts`, `level`, `service`, `requestId`, `userId`, `articleId`, `jobId`, `msg`.
- **Traces**: OpenTelemetry across Next.js → Python; propagate W3C `traceparent` through the queue job payload.
- **Metrics**: Prometheus-compatible. Golden signals per service + ingestion-specific (parse time, extraction time, repair count).
- **Error tracking**: Sentry (web + python).

## 8. Deployment

| Env     | Web                 | Python           | DB                 | Redis           | Object store |
|---------|---------------------|------------------|--------------------|-----------------|--------------|
| local   | `pnpm dev`          | `uv run fastapi` | docker compose     | docker compose  | MinIO        |
| preview | Vercel preview      | Fly.io (PR app)  | Neon branch        | Upstash (dev)   | R2 (preview) |
| prod    | Vercel              | Fly.io or ECS    | Neon or RDS        | Upstash         | S3 / R2      |

## 9. Configuration

- `.env.local` for local dev (never committed).
- Prod config via Vercel / Fly secrets.
- All env vars validated at boot with Zod (web) / Pydantic Settings (python). Missing var = fail fast, loud.

## 10. Repo & tooling

- Monorepo via **pnpm workspaces** + **Turborepo** for the TS side.
- Python side uses **uv** workspaces (`services/ingestion` as a member).
- Shared types generated: Python Pydantic → OpenAPI → `openapi-typescript` → `packages/types`.
- Lint: ESLint (web), ruff (python). Format: Prettier, ruff format.
- Pre-commit: lefthook running lint-staged + ruff.
