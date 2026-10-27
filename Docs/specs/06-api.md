# 06 — API Contracts

> HTTP contracts between the browser, Next.js, and the Python ingestion service. Pydantic in Python is the source of truth; OpenAPI is generated from it; TypeScript types are generated from the OpenAPI schema into `packages/types`.

## 1. Conventions

- All endpoints are JSON unless noted. UTF-8.
- Timestamps are ISO 8601 with timezone.
- IDs are cuid (24-char base-36-ish).
- Errors follow a single shape:
  ```json
  {
    "error": {
      "code": "ARTICLE_NOT_FOUND",
      "message": "No article with slug 'foo'",
      "details": { "slug": "foo" }
    }
  }
  ```
- Pagination uses cursor: `?cursor=...&limit=20`. Response: `{ "data": [...], "nextCursor": "..." }`.
- All mutating endpoints require authentication (session cookie) and CSRF token header `x-csrf-token`.
- Server→service calls use short-lived service tokens (`Authorization: Bearer sv_...`) with scopes.

## 2. Public web API (Next.js)

### 2.1 Articles

```
GET    /api/articles?cursor=&limit=&status=&categoryId=&tagId=&updatedWithin=
GET    /api/articles/:idOrSlug
POST   /api/articles                             # author+
PATCH  /api/articles/:id                         # author (own) or reviewer+
POST   /api/articles/:id/publish                 # reviewer+
POST   /api/articles/:id/unpublish               # reviewer+
POST   /api/articles/:id/archive                 # admin
POST   /api/articles/:id/view                    # fire-and-forget; records view
POST   /api/articles/:id/feedback                # { helpful: bool, comment?: string }
GET    /api/articles/:id/versions                # reviewer+
POST   /api/articles/:id/versions/:versionId/rollback   # admin
GET    /api/articles/:id/export/pdf              # 302 to signed URL
```

**`GET /api/articles/:idOrSlug`** response:

```json
{
  "id": "ck...",
  "slug": "windows-11-reset-local-admin-password",
  "title": "Windows 11 - Resetting the Local Administrator Password",
  "summary": "This article provides step-by-step instructions...",
  "heroImageUrl": "https://.../hero.png",
  "status": "published",
  "readingTimeMinutes": 5,
  "version": "1.2",
  "category": { "id": "...", "name": "Windows", "slug": "windows" },
  "tags": [
    { "id": "...", "name": "Windows 11", "slug": "windows-11" },
    { "id": "...", "name": "Password", "slug": "password" },
    { "id": "...", "name": "Local Admin", "slug": "local-admin" }
  ],
  "author": { "id": "u_...", "name": "Joe Clark", "avatarUrl": "..." },
  "sections": [ { "kind": "overview", "title": "Overview", "blocks": [...] }, ... ],
  "metrics": { "views": 12480, "helpful": 213, "notHelpful": 7 },
  "createdAt": "2026-09-12T14:02:00Z",
  "updatedAt": "2026-09-12T14:42:00Z",
  "publishedAt": "2026-09-12T14:42:00Z"
}
```

### 2.2 Search

```
GET /api/search?q=&categoryId=&tagId=&status=&limit=
```

Response:

```json
{
  "query": "reset admin password",
  "took_ms": 42,
  "hits": [
    {
      "id": "...",
      "slug": "...",
      "title": "...",
      "snippet": "...<mark>reset</mark>...",
      "category": { "name": "Windows", "slug": "windows" },
      "tags": [{ "name": "Password" }],
      "author": { "name": "Joe Clark" },
      "updatedAt": "..."
    }
  ],
  "nextCursor": null
}
```

### 2.3 Taxonomy

```
GET    /api/categories
POST   /api/categories                   # admin
PATCH  /api/categories/:id               # admin
POST   /api/categories/:id/merge         # admin
GET    /api/tags
POST   /api/tags                         # author+
PATCH  /api/tags/:id                     # admin
POST   /api/tags/:id/merge               # admin
```

### 2.4 Upload / ingestion

```
POST /api/upload/presign
  body:     { fileName, contentType, sizeBytes }
  response: { key, url, headers, maxBytes }      # PUT directly to S3 from browser

POST /api/upload/complete
  body:     { key, originalFileName, sizeBytes, sourceKind }
  response: { jobId }                             # creates a queued IngestionJob; the stream route runs it

GET  /api/jobs/:jobId
  response: { jobId, status, stage, articleId?, errorMessage?, startedAt, finishedAt }

GET  /api/jobs/:jobId/stream   (text/event-stream)
  effect:  claims the job, calls Python /ingest with Accept: text/event-stream, saves the draft
  events:
    event: progress  data: { jobId, stage, status, detail, progress }
    event: done      data: { jobId, articleId, slug }
    event: failed    data: { jobId, code, message }
```

### 2.5 Admin

```
GET    /api/admin/users
POST   /api/admin/users/invite
PATCH  /api/admin/users/:id          # change role, deactivate
GET    /api/admin/settings
PATCH  /api/admin/settings
GET    /api/admin/integrations
PATCH  /api/admin/integrations/:kind # servicenow | jira | teams
POST   /api/admin/integrations/:kind/test
```

### 2.6 Analytics

```
GET /api/analytics/overview?range=7d|30d|90d
GET /api/analytics/articles/:id?range=30d
GET /api/analytics/stale?olderThanDays=365
```

## 3. Internal API (Python → Next.js)

Called by the ingestion service with `Authorization: Bearer sv_...`. Scopes are checked per endpoint.

```
POST /api/internal/articles                     # scope: article:write
  body: ArticleDraft (full JSON per 03-data-model §5) + { jobId }
  response: { articleId, slug, versionId }

PATCH /api/internal/jobs/:jobId                 # scope: job:write
  body: { status, stage?, errorMessage?, startedAt?, finishedAt?, tokens?, costUsd? }

POST  /api/internal/jobs/:jobId/events          # scope: job:write
  body: ProgressEvent (per 05-ai-ingestion §4)
  effect: writes to Redis stream (and persists terminal events)
```

Service tokens are issued per environment, rotated every 30 days, and scoped minimally. Stored in Vercel secrets and injected into the Python service via its deploy pipeline (never in the repo).

## 4. Ingestion service API (Next.js → Python)

The service is reachable only from Next.js (private network / allowlist).

```
POST /v1/uploads/presign
  headers: Authorization: Bearer v1...   # author, reviewer, or admin
  body:    { fileName, contentType, sizeBytes }
  effect:  returns { key, url, headers } for a browser PUT. The key is uploads/{userId}/{id}/{fileName}.
           Storage env is TB_S3_ENDPOINT, TB_S3_BUCKET, TB_S3_REGION, TB_S3_ACCESS_KEY, TB_S3_SECRET_KEY.
           Missing storage returns 503.

POST /ingest
  headers: Authorization: Bearer v1...   # user-triggered; 60s assertion
           Authorization: Bearer sv_...   # worker; service credential, later
  body:    { jobId, s3Key, fileName, sourceKind, sizeBytes, hints?: { category?, tags? } }
  effect:  local, no queue: downloads s3Key (must be that user's uploads/ prefix).
           Accept: application/json → 200 { jobId, draft }.
           Accept: text/event-stream → SSE progress events, then event: done with { jobId, draft }, or event: failed.
           A queue later returns 202 and does not include the draft.

GET  /healthz
GET  /readyz
GET  /metrics          # Prometheus
```

In Vercel-hosted mode, Next.js *does not* call `/ingest` synchronously; it writes a BullMQ job and the Python service consumes the queue. That queue is not built yet. Locally, Next calls `/ingest` on the request, saves the draft, and the editor opens.

The same reader is also available without storage:

```
POST /v1/parse/docx
POST /v1/parse/pdf
  headers: Authorization: Bearer v1...   # author, reviewer, or admin
  body:    multipart file field `file` (.docx or .pdf, max 25MB)
  effect:  returns a draft (title, summary, five sections). Does not write the database.
           A scanned PDF page is described in the overview and is not read.
```

## 5. Rate limiting

Per-IP and per-user. Login attempts are counted in Postgres (`auth.login_attempt`) until Redis is wired. Other limits stay as specified and land with the feature that needs them:

| Scope                 | Window | Limit |
|-----------------------|--------|-------|
| Login attempts        | 10 min | 5     |
| Upload / ingest start | 1 day  | 20    |
| Search                | 1 min  | 60    |
| Feedback              | 7 days | 1 per article |

Exceeding returns `429` with `Retry-After`.

## 6. CSRF, cookies, and sessions

- Session cookie: `__Host-tb_session`, `Secure`, `HttpOnly`, `SameSite=Lax`, path `/`. The value is an opaque id. Postgres stores its hash. See [ADR 0001](adr/0001-server-managed-sessions.md).
- CSRF token: double-submit cookie `tb_csrf` + `x-csrf-token` header on mutating requests. SameSite=Strict for the CSRF cookie.
- Next.js calls FastAPI with `Authorization: Bearer v1.<payload>.<signature>`, a 60-second HMAC assertion minted after the session is valid. FastAPI rejects a missing, expired, or badly signed assertion. Background jobs use `Authorization: Bearer sv_...` and do not use the user session.

## 7. Versioning

- The public web API is unversioned (`/api/...`) because it's internal to the app. Breaking changes are rolled out with the frontend atomically.
- The internal and ingestion APIs are versioned via header `x-tb-api-version: 2026-10-01`. Deprecations announced one minor release before removal.

## 8. OpenAPI & type generation

- The Python service exports `/openapi.json`.
- `pnpm gen:types` runs `openapi-typescript` and writes `packages/types/src/ingestion.ts`.
- Next.js uses these types for both internal and ingestion-facing code; drift between Python and TS fails CI.
