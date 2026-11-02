# 08 — Roadmap

Deliverable-oriented. Dates were relative to kickoff (Week 1). Each milestone has a demo-able outcome.

**Status key (2026-10-30):** ✅ done · 🟡 partial / follow-up · ⬜ not started. Paths are `frontend/` and `backend/` (not the draft `apps/web` / `services/ingestion` names). Detail lives in `progress.md` and `Docs/suggested-order.md`.

---

## M0 — Foundations (Week 1) — ✅ (compose optional)

**Outcome**: a reviewer can read all specs, see the mock, clone the repo, and run a working dev shell (UI + Python `/healthz`).

- ✅ Specs merged (this folder).
- ✅ Web scaffold with Next.js ≥ 16.4.3, Tailwind v4, shadcn, strict TS (`frontend/`).
- ✅ Ingestion scaffold with FastAPI, uv, ruff, pytest (`backend/`).
- 🟡 `infra/compose/docker-compose.yml` — **not in-repo**; Postgres, Redis, SeaweedFS/MinIO run externally.
- ✅ CI: lint + typecheck + test for both sides (+ OpenAPI drift, security audit).
- ✅ OpenAPI → TS types generation wired up.

---

## M1 — Shell + article detail (Week 2–3) — ✅

**Outcome**: the exact view in the mock renders from seeded data, keyboard-navigable, dark/light themed.

- ✅ App shell (sidebar + top bar + canvas), dark sidebar always-on.
- ✅ Theme toggle (light/dark/system) with no FOUC.
- ✅ Brand mark component.
- ✅ Design-system primitives in `components/ui/` (and composites): Button, Chip, Callout, CodeBlock, SectionHeader, StepBadge, Checklist, …
- ✅ `/kb/[slug]` server-rendered article view with sticky TOC and meta rail.
- ✅ Code highlighting in article code blocks (read view).
- ✅ `Ctrl+K` palette with Articles + Actions scopes.
- ✅ 20 seed articles (realistic IT content).
- ✅ Lighthouse Perf ≥ 90 on public `/kb/[slug]` (signed-in shell TBT is a follow-up).

---

## M2 — Authoring (Week 4) — ✅

**Outcome**: a user can create or edit an article in the two-pane editor and publish it.

- ✅ TipTap editor with custom nodes matching the read-view styling.
- ✅ Structure sidebar (section list, drag reorder, add section).
- ✅ Autosave to Postgres (interval / blur); Redis buffer later.
- ✅ Publish flow with validation checklist and version bump.
- ✅ `ArticleVersion` creation on each publish.

---

## M3 — Ingestion (Week 5–6) — ✅ (OCR post-pilot)

**Outcome**: a user can upload a DOCX or PDF, see live progress, and land in a structured draft within ~60s for a 10-page doc.

- ✅ Upload UI (dropzone, presign, S3 PUT).
- ✅ BullMQ queue + Node worker (`pnpm worker:ingest`) calling FastAPI; Redis stream `jobs:{id}:events` for SSE. Without `REDIS_URL`, stream route still runs in-process.
- ✅ DOCX parser (python-docx).
- ✅ PDF parser (pdfplumber); scanned pages noted and skipped; ✅ unstructured fallback on primary parse failure (`lowFidelitySource`); OCR post-pilot.
- ✅ Segment → candidate section heuristic (`backend/parse/segments.py`; kinds are suggestions for the LLM).
- ✅ Structure via `KBExtractor` (`OpenAICompatibleExtractor` default, `FakeExtractor` for tests) + one repair.
- ✅ Pydantic / JSON validation with one-shot repair + post-extract checks (`backend/parse/validate.py`).
- ✅ SSE progress stream.
- ✅ Fallback to a human-fixable draft on repeated failure (`lowConfidence` / `succeeded_with_warnings`).
- ✅ Artifact bundle persisted to S3 for 7 days (`uploads/{yyyy}/{mm}/{jobId}/artifact.json` + source copy; `uv run ingest replay`).
- ✅ Stage timings on job + stepper; OpenTelemetry ingest spans + W3C `traceparent` (Next → BullMQ → FastAPI). Dashboards stay M7.

---

## M4 — Search, categories, tags (Week 7) — ✅

**Outcome**: content is findable without knowing exact titles.

- ✅ Postgres FTS with weighted search.
- ✅ `/api/search` with filters.
- ✅ Search results UI with snippet highlighting (`Ctrl+K` + `/kb`).
- ✅ Categories admin: CRUD + merge (+ color).
- ✅ Tags admin: CRUD + merge.
- ✅ `/categories/[slug]` and `/tags/[slug]` listing pages.
- ✅ Related articles by FTS (embeddings post-pilot).

---

## M5 — Auth & admin (Week 8) — ✅ Phase A + most of Phase B

**Outcome**: the app requires a login; roles are enforced on the server. Decision: [ADR 0001](adr/0001-server-managed-sessions.md).

Phase A — core:

- ✅ Auth tables in the `auth` Postgres schema, linked from `User.identityId`.
- ✅ Password login, opaque session cookie, logout, and revocation.
- ✅ Password reset and email verification.
- ✅ Next.js gate on every page. Published articles may be marked public.
- ✅ FastAPI rejects calls that lack a valid 60-second assertion.
- ✅ Role checks from `07-security.md`, auth audit events, login rate limit.
- ✅ Tests; second-app install notes in `auth/web/README.md`.

Phase B:

- ✅ MFA and recovery codes; passkeys. Optional; same session cookie.
- ⬜ Permissions finer than the four roles; organizations.
- ⬜ OIDC (Entra ID, Google Workspace) and SAML 2.0 — **post-pilot** (pilot uses password + optional MFA/passkeys).
- ✅ Users admin, settings, and the integrations shell (Slack publish live; other connectors stub/config).
- ✅ CSP, HSTS, and the remaining security headers (`proxy.ts`).

---

## M6 — Feedback, analytics, versioning (Week 9–10) — ✅

**Outcome**: KB owners can see what matters and roll back mistakes.

- ✅ Thumbs feedback with optional comment, rate-limited.
- ✅ Unique view counting (one open per viewer per UTC day). Redis HLL later.
- ✅ Global analytics dashboard.
- ✅ Per-article analytics.
- ✅ Version picker + side-by-side section compare.
- ✅ Rollback (admin).

Also shipped in this era (specs 09–12): page tree, field notes (replies/@mentions later), per-page permissions.

---

## M7 — Hardening (Week 11) — 🟡

**Outcome**: production-ready.

- ✅ A11y: axe-core clean on key routes; keyboard walkthrough passed 2026-11-02 (`13-a11y-keyboard.md`).
- ✅ Visual regression on article view (`15-visual-regression.md`).
- 🟡 Load test: **100 concurrent ingestions** ✅; **1k rps** on article detail ⬜ (local SSR health gate ~43 rps; CDN/cache follow-up) — `16-load.md`.
- ✅ OWASP ASVS L1 checklist (`17-security-asvs-l1.md`).
- ⬜ Observability: traces across web and python, dashboards for golden signals + ingestion-specific.

---

## M8 — Pilot (Week 12) — 🟡 scaffold

**Outcome**: internal IT team adopts it.

- 🟡 Rollout: **single-tenant**, current local env as-is; checklist in `18-pilot.md`.
- 🟡 Content: IT admins **Create** and/or **Import** (Evidence table ready; live rows deferred).
- ⬜ Office hours + feedback loop.
- ⬜ Post-pilot report with Go/No-Go for GA (`Docs/pilot/go-no-go.md` template).

Pre-pilot decisions (2026-10-30): single tenant; prod LLM = current `AI_*` / OpenRouter stack; no SSO required for pilot.

---

## Post-GA candidates (prioritized) — all ⬜

1. **Semantic search / related articles** via embeddings (pgvector).
2. **OCR for scanned PDFs** (Tesseract on the ingestion service).
3. **Multi-tenant SaaS mode** (pilot is single-tenant).
4. **Realtime co-editing** (Y.js, Hocuspocus).
5. **Browser extension**: "Draft article from this page" (ingest a URL).
6. **Ticket-system import**: pull resolved tickets from Jira/ServiceNow as draft candidates.
7. **Scheduled review reminders**: nudge owners of articles not updated in N months.
8. **AI Assistant panel**: in-article Q&A grounded in the current article + its related set (`/assistant` nav stub only).
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
