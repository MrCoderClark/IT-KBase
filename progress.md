# TechBase — Progress Tracker

> Living document. Update on every meaningful change. Keep entries terse — one line each. Link to specs/PRs rather than restating them.

Last updated: 2026-10-12 (feat/app-shell)

Legend: `✅ done` · `🟡 in-progress` · `⬜ todo` · `⛔ blocked` · `🧪 experimental`

---

## 0. Milestones

| # | Milestone                           | Target        | Status |
|---|-------------------------------------|---------------|--------|
| M0 | Foundations: specs + repo scaffold | Week 1        | 🟡     |
| M1 | Article detail view matches mock   | Week 3        | 🟡     |
| M2 | Create / edit article (manual)     | Week 4        | ⬜     |
| M3 | Word/PDF ingestion → draft article | Week 6        | ⬜     |
| M4 | Search, categories, tags           | Week 7        | ⬜     |
| M5 | Auth, roles, admin console         | Week 8        | ⬜     |
| M6 | Analytics, feedback, versioning    | Week 10       | ⬜     |
| M7 | Hardening, a11y audit, perf        | Week 11       | ⬜     |
| M8 | Pilot release to internal IT       | Week 12       | ⬜     |

---

## 1. Foundations (M0)

- ✅ Capture product mock (`Docs/mocks/TechBase Windows Knowledge Article.png`)
- ✅ `claude.md` — AI agent guide
- ✅ `progress.md` — this file
- ✅ `Docs/specs/00-overview.md` — vision, personas, principles
- ✅ `Docs/specs/01-architecture.md` — system diagram, services, deploys
- ✅ `Docs/specs/02-design-system.md` — tokens, components, motion, voice
- ✅ `Docs/specs/03-data-model.md` — entities, Redis layout, Postgres schema
- ✅ `Docs/specs/04-features.md` — feature-by-feature behavior
- ✅ `Docs/specs/05-ai-ingestion.md` — upload → structured article pipeline
- ✅ `Docs/specs/06-api.md` — HTTP contracts between Next.js and Python
- ✅ `Docs/specs/07-security.md` — authn/z, data handling, compliance
- ✅ `Docs/specs/08-roadmap.md` — milestone detail and risks
- ⬜ `Docs/specs/adr/0001-stack-choices.md` — record locked stack decisions
- ✅ Scaffold `frontend/` (Next.js 16, React 19, Tailwind v4, Turbopack, TS strict)
- ✅ Scaffold `backend/` (Python 3.12, uv) — package only; FastAPI entry not wired yet
- ✅ Root `.gitignore` covering Python caches, venvs, env files, OS/editor cruft
- ⬜ `backend/` → FastAPI skeleton with `/healthz`
- ⬜ `infra/compose/docker-compose.yml` — Postgres, Redis, MinIO
- ⬜ CI: lint + typecheck + test on PR (web + python)
- ⬜ Generate TS client from Python OpenAPI
- ⬜ Seed data: 20 realistic IT articles across Windows, Linux, M365, Networking, Security

---

## 2. Web app (M1 → M2)

### Shell & navigation
- ✅ Design tokens wired to Tailwind v4 (`@theme inline` in `globals.css`)
- ✅ Dark sidebar + light canvas layout (per mock)
- ✅ Brand mark (isometric cobalt polyhedron) + wordmark
- ✅ Primary nav (Home, Knowledge Base w/ children, Create, Categories, Tags, AI Assistant, Import, Analytics)
- ✅ Admin sub-nav (Users, Settings, Integrations)
- ✅ Upload CTA card (bottom of sidebar) with gradient treatment
- 🟡 Top bar: layout + bell + theme toggle + profile stub done; search is a non-functional disclosure
- ✅ Light / dark theme toggle (persists in `localStorage`, no FOUC via pre-paint script)
- ⬜ Command palette (`cmdk`) with scoped scopes: articles, actions, nav
- ⬜ Wire search disclosure to open the palette
- ⬜ User menu dropdown (profile, keyboard shortcuts, sign out)
- ⬜ Notifications panel

### Article detail view
- ⬜ Breadcrumbs
- ⬜ Title block (category chip, title, summary, metadata row)
- ⬜ Hero image slot (right-aligned, aspect-ratio locked)
- ⬜ Edit / Share / overflow actions
- ⬜ In-article table of contents (sticky)
- ⬜ Section renderers: Overview, Prerequisites (checklist), Steps (numbered), Verification, Troubleshooting, Related
- ⬜ Callout component (Info, Important, Warning, Success)
- ⬜ Code block with copy affordance
- ⬜ Right rail: Article Details, Related Articles, Quick Actions, Was-this-helpful
- ⬜ Keyboard shortcuts (`e` edit, `s` share, `?` help, `g a` go to articles)

### Browse / list
- ⬜ All Articles table (compact density, sortable, filter chips)
- ⬜ My Drafts, Shared With Me, Recently Updated views
- ⬜ Category and Tag index pages

---

## 3. Authoring (M2)

- ⬜ Create Article wizard (manual path)
- ⬜ TipTap editor with custom nodes (Prerequisite, Step, Verification, Callout, CodeBlock)
- ⬜ Side-by-side preview matching read view
- ⬜ Autosave to Redis every 10s, debounced persist to Postgres
- ⬜ Publish flow with checklist (title, category, 1+ tag, summary, ≥1 step)
- ⬜ Version bump UX (minor/major)

---

## 4. Ingestion (M3)

- ⬜ Upload UI (drag-drop + file picker, DOCX/PDF, max 25MB)
- ⬜ S3 presigned-upload flow
- ⬜ `POST /ingest` kicks off Python job, returns `jobId`
- ⬜ Live progress via SSE (parse → extract → structure → validate)
- ⬜ Draft article landing page on completion
- ⬜ Python: DOCX parser (python-docx)
- ⬜ Python: PDF parser (pdfplumber primary, unstructured fallback)
- ⬜ Python: segmenter (headings → candidate sections)
- ⬜ Python: `KBExtractor` interface + OpenAI implementation
- ⬜ Python: Pydantic validator with one-shot repair
- ⬜ Python: emit progress events to Redis stream
- ⬜ Observability: trace a full ingestion end-to-end

---

## 5. Search & taxonomy (M4)

- ⬜ Postgres FTS with `tsvector` + ranking
- ⬜ `Ctrl+K` palette hits articles, actions, and nav
- ⬜ Facets: category, tag, status, updated-within
- ⬜ Category CRUD (admin)
- ⬜ Tag CRUD + merge
- ⬜ Related articles: lexical + embedding similarity (nice-to-have in M4)

---

## 6. Auth & admin (M5)

- ⬜ Auth.js with credentials (dev) and OIDC (prod)
- ⬜ Roles: `reader`, `author`, `reviewer`, `admin`
- ⬜ Row-level permissions on drafts
- ⬜ Users admin page
- ⬜ Settings (branding, retention, allowed domains)
- ⬜ Integrations placeholder (ServiceNow, Jira, Teams webhook)

---

## 7. Feedback, analytics, versioning (M6)

- ⬜ Thumbs up/down + optional comment
- ⬜ View counting (Redis HLL for uniques)
- ⬜ Article analytics page (per-article trend)
- ⬜ Global analytics dashboard
- ⬜ Version history + diff viewer
- ⬜ Rollback to previous version

---

## 8. Quality (M7)

- ⬜ A11y: axe-core clean, keyboard-only walkthrough recorded
- ⬜ Lighthouse: Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 95 on key routes
- ⬜ Visual regression (Playwright + screenshot diffs) on article view
- ⬜ Load test: 100 concurrent ingestions
- ⬜ Security review: OWASP ASVS L1 pass

---

## 9. Decisions log

| Date       | Decision                                     | Rationale                                     |
|------------|----------------------------------------------|-----------------------------------------------|
| 2026-10-12 | Next.js 15 App Router + RSC                  | Streaming, server-first, matches team skillset |
| 2026-10-12 | Python FastAPI for ingestion                 | Mature doc-parsing ecosystem (`python-docx`, `pdfplumber`, `unstructured`) |
| 2026-10-12 | Redis for cache, sessions, queue (BullMQ)    | One operational dependency for three jobs      |
| 2026-10-12 | Postgres (Prisma) as primary store           | Relational model fits versioned articles       |
| 2026-10-12 | Pydantic as source-of-truth schema           | Generate TS types to prevent drift             |
| 2026-10-12 | Next 16 + React 19 + Tailwind v4 + Turbopack | Matches installed scaffold; `cacheComponents` + `partialPrefetching` on |
| 2026-10-12 | `lucide-react@1.x` for icons                 | Design-system standard; `Home` is now `House`  |
| 2026-10-12 | shadcn primitives installed by user, restyled by agent (claude.md §0.3) | Avoid hand-authored drift from shadcn source   |
| 2026-10-12 | Shell commands run by user, PowerShell syntax (claude.md §0.1) | Windows dev environment, agent proposes only   |

---

## 10. Open questions

- ⬜ Do we need multi-tenant from day one, or single-tenant with a tenant-id baked in for later?
- ⬜ Which LLM provider is primary in prod — self-hosted (vLLM + Llama 3.1 70B) or managed (OpenAI/Anthropic)? Keep interface pluggable regardless.
- ⬜ Is SSO (OIDC) a pilot requirement or post-pilot?
- ⬜ PDF OCR for scanned docs — in scope for M3 or deferred?

---

## 11. Risks

- **LLM extraction quality on messy PDFs.** Mitigation: unstructured fallback, human-in-the-loop draft, strict Pydantic validation.
- **Scope creep into "general wiki".** Mitigation: ruthlessly keep IT-pro framing; reject features that aren't about ingesting or finding IT runbooks.
- **Design drift toward generic SaaS.** Mitigation: enforce `02-design-system.md`; review each new screen against the mock.
