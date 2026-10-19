# 08 — Roadmap

Deliverable-oriented. Dates are relative to kickoff (Week 1). Each milestone has a demo-able outcome.

## M0 — Foundations (Week 1)

**Outcome**: a reviewer can read all specs, see the mock, clone the repo, and `docker compose up` a working dev shell (empty UI, Python service answering `/healthz`).

- Specs merged (this folder).
- `apps/web` scaffold with Next.js 15, Tailwind v4, shadcn, strict TS.
- `services/ingestion` scaffold with FastAPI, uv, ruff, pytest.
- `infra/compose/docker-compose.yml` for Postgres, Redis, MinIO.
- CI: lint + typecheck + test for both sides.
- OpenAPI → TS types generation wired up.

## M1 — Shell + article detail (Week 2–3)

**Outcome**: the exact view in the mock renders from seeded data, keyboard-navigable, dark/light themed.

- App shell (sidebar + top bar + canvas), dark sidebar always-on.
- Theme toggle (light/dark/system) with no FOUC.
- Brand mark component.
- Design-system primitives in `components/ui/`: Button, Chip, Callout, CodeBlock, SectionHeader, StepBadge, Checklist.
- `/kb/[slug]` server-rendered article view with sticky TOC and meta rail.
- Shiki server-side code highlighting.
- `Ctrl+K` palette with Articles + Actions scopes.
- 20 seed articles (realistic IT content).
- Lighthouse Perf ≥ 90 on `/kb/[slug]`.

## M2 — Authoring (Week 4)

**Outcome**: a user can create or edit an article in the two-pane editor and publish it.

- TipTap editor with custom nodes matching the read-view styling.
- Structure sidebar (section list, drag reorder, add section).
- Autosave to Redis + persist to Postgres.
- Publish flow with validation checklist and version bump.
- `ArticleVersion` creation on each publish.

## M3 — Ingestion (Week 5–6)

**Outcome**: a user can upload a DOCX or PDF, see live progress, and land in a structured draft within ~60s for a 10-page doc.

- Upload UI (dropzone, presign, S3 PUT).
- BullMQ queue + Python worker.
- DOCX parser (python-docx).
- PDF parser (pdfplumber primary, unstructured fallback).
- Segment → candidate section heuristic.
- `KBExtractor` interface + `OpenAIExtractor` + `FakeExtractor` for tests.
- Pydantic validator with one-shot repair.
- SSE progress stream.
- Fallback path to a `custom`-section draft on repeated failure.
- Artifact bundle persisted to S3 for 7 days.

## M4 — Search, categories, tags (Week 7)

**Outcome**: content is findable without knowing exact titles.

- Postgres FTS with weighted `tsvector`.
- `/api/search` with filters.
- Search results UI with snippet highlighting.
- Categories admin: CRUD + merge.
- Tags admin: CRUD + merge.
- `/categories/[slug]` and `/tags/[slug]` listing pages.

## M5 — Auth & admin (Week 8)

**Outcome**: the app requires a login; roles are enforced on the server. Decision: [ADR 0001](adr/0001-server-managed-sessions.md).

Phase A — core, in this order:

- Auth tables in the `auth` Postgres schema, linked from `User.identityId`.
- Password login, opaque session cookie, logout, and revocation.
- Password reset and email verification.
- Next.js gate on every page. Published articles may be marked public.
- FastAPI rejects calls that lack a valid 60-second assertion.
- Role checks from `07-security.md`, auth audit events, login rate limit.
- Tests, and a written example of installing the module in a second app.

Phase B — after Phase A is verified:

- MFA and recovery codes, then passkeys. Both are optional and issue the same session cookie.
- Permissions finer than the four roles. Organizations.
- OIDC (Entra ID, Google Workspace) and SAML 2.0 where required.
- Users admin, settings, and the integrations shell.
- CSP, HSTS, and the remaining security headers.

## M6 — Feedback, analytics, versioning (Week 9–10)

**Outcome**: KB owners can see what matters and roll back mistakes.

- Thumbs feedback with optional comment, rate-limited.
- Unique view counting. One open per viewer per UTC day increments `Article.views`. Redis HLL is later.
- Global analytics dashboard.
- Per-article analytics page.
- Version picker + side-by-side diff.
- Rollback (admin).

## M7 — Hardening (Week 11)

**Outcome**: production-ready.

- A11y pass: axe-core clean on key routes; keyboard-only walkthrough recorded.
- Visual regression on article view.
- Load test: 100 concurrent ingestions, 1k rps on article detail.
- OWASP ASVS L1 pass.
- Observability: traces across web and python, dashboards for golden signals + ingestion-specific.

## M8 — Pilot (Week 12)

**Outcome**: internal IT team adopts it.

- Rollout to pilot tenant.
- Import of real existing docs (Word/PDF).
- Office hours + feedback loop.
- Post-pilot report with Go/No-Go for GA.

---

## Post-GA candidates (prioritized)

1. **Semantic search / related articles** via embeddings (pgvector).
2. **OCR for scanned PDFs** (Tesseract on the ingestion service).
3. **Multi-tenant SaaS mode** (if not already day-one).
4. **Realtime co-editing** (Y.js, Hocuspocus).
5. **Browser extension**: "Draft article from this page" (ingest a URL).
6. **Ticket-system import**: pull resolved tickets from Jira/ServiceNow as draft candidates.
7. **Scheduled review reminders**: nudge owners of articles not updated in N months.
8. **AI Assistant panel**: in-article Q&A grounded in the current article + its related set.
9. **Mobile companion** (responsive is fine for v1; native later if demand).
10. **Public portal mode**: expose a curated subset externally with watermarks.

---

## Risks & mitigations

| Risk                                          | Mitigation                                                                 |
|-----------------------------------------------|----------------------------------------------------------------------------|
| LLM output drift between model versions       | Pinned model + prompt; snapshot tests on golden corpus; replay tool        |
| Visual design slides into "generic SaaS"      | Design-system spec is enforced; every PR with UI gets a design review      |
| Scope creep toward "general wiki"             | Features explicitly tied to IT runbook model; reject anything else to post-GA |
| Ingestion cost explodes                       | Per-tenant monthly token budget, warning at 80%, hard cutoff at 100%        |
| Python service becomes a second ops burden    | One image, one deploy, autoscale to zero in non-prod; share obs stack       |
