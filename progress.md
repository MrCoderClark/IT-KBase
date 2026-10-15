# TechBase — Progress Tracker

> Living document. Update on every meaningful change. Keep entries terse — one line each. Link to specs/PRs rather than restating them.

Last updated: 2026-10-14 (feat/auth-phase-a)

Legend: `✅ done` · `🟡 in-progress` · `⬜ todo` · `⛔ blocked` · `🧪 experimental`

---

## 0. Milestones

| # | Milestone                           | Target        | Status |
|---|-------------------------------------|---------------|--------|
| M0 | Foundations: specs + repo scaffold | Week 1        | 🟡     |
| M1 | Article detail view matches mock   | Week 3        | 🟡 (detail view done; Share copies the link; `e`, `g a`, `g h`, and `?` done; `s` and the rest remain) |
| M2 | Create / edit article (manual)     | Week 4        | 🟡 (overview and step bodies are TipTap with bold, italic, and lists; custom nodes and autosave remain) |
| M3 | Word/PDF ingestion → draft article | Week 6        | ⬜     |
| M4 | Search, categories, tags           | Week 7        | ⬜     |
| M5 | Auth, roles, admin console         | Week 8        | 🟡 (ADR 0001 accepted; Phase A code not started) |
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
- ✅ `Docs/specs/adr/0001-server-managed-sessions.md` — opaque Postgres sessions, Next.js BFF, 60s assertion to FastAPI, login wall with a per-article public flag
- ⬜ `Docs/specs/adr/0002-stack-choices.md` — record the remaining locked stack decisions
- ✅ Scaffold `frontend/` (Next.js 16, React 19, Tailwind v4, Turbopack, TS strict)
- ✅ Scaffold `backend/` (Python 3.12, uv) — package only; FastAPI entry not wired yet
- ✅ Root `.gitignore` covering Python caches, venvs, env files, OS/editor cruft
- ✅ `backend/` → FastAPI skeleton (`/healthz`, `/readyz`, `/docs`, structlog JSON, Pydantic Settings, pytest + ruff config, 4 smoke tests)
- ✅ Docker, Redis, SeaweedFS (S3-compat) already running externally — no compose file needed in-repo yet
- ⬜ CI: lint + typecheck + test on PR (web + python)
- ⬜ Generate TS client from Python OpenAPI
- ✅ Prisma schema (`frontend/prisma/schema.prisma`) matching `03-data-model.md`; pinned to Prisma 6 (v8 RC CLI dropped `migrate`)
- ✅ `/kb` and `/kb/[slug]` read from Postgres; seed loads 4 users, 7 categories, tags, and 11 articles
- 🟡 Seed data: 11 of ~20 articles across Windows, Linux, M365, Networking, Security, AD, Integrations

---

## 2. Web app (M1 → M2)

### Shell & navigation
- ✅ Design tokens wired to Tailwind v4 (`@theme inline` in `globals.css`)
- ✅ Dark sidebar + light canvas layout (per mock)
- ✅ Brand mark (isometric cobalt polyhedron) + wordmark
- ✅ Primary nav (Home, Knowledge Base w/ children, Create, Categories, Tags, AI Assistant, Import, Analytics)
- ✅ Admin sub-nav (Users, Settings, Integrations)
- ✅ Upload CTA card (bottom of sidebar) with gradient treatment
- ✅ Home brief: published count, your drafts (links to `/kb/drafts`), in-review count, and the five newest articles
- 🟡 Top bar: layout + bell + theme toggle done; search opens the command palette. Avatar menu has Sign out. Profile and shortcut entries remain
- ✅ Light / dark theme toggle (persists in `localStorage`, no FOUC via pre-paint script)
- ✅ Command palette (`cmdk`): `Ctrl+K` and the top-bar search find articles by title, category, and tag, and jump to Home, Knowledge Base, Create, Categories, and Tags
- ⬜ Command palette scopes for actions and recently viewed
- 🟡 User menu: avatar opens a dropdown with Sign out (checked in the browser). Profile and keyboard-shortcut entries remain
- ⬜ Notifications panel

### Article detail view
- ✅ Breadcrumbs (`Knowledge Base > Articles`)
- ✅ Title block (category chip, h1 title, summary, metadata row with dot separators)
- ✅ Hero image slot (right-aligned, 16/10 aspect ratio, gradient placeholder)
- ✅ Edit and Share (copies the article link). Overflow stays a stub
- ✅ In-article table of contents (sticky left rail, 210px, IntersectionObserver active tracking)
- ✅ Section renderers: Overview, Prerequisites (checklist), Steps (numbered badges), Verification, Troubleshooting, Related
- ✅ Callout component (Info, Important, Warning, Success) — 4 variants, left-border tinted panels
- ✅ Code block with copy affordance (dark `#0B1220`, monospace, language label)
- ✅ Right rail: Article Details, Related Articles (same category, then other published articles), Quick Actions, Was-this-helpful (sticky, 300px)
- ✅ Article types (`lib/types/article.ts`) and seed data (`lib/seed/articles.ts`)
- ✅ Minimal All Articles page (`/kb`) linking to seed article
- ✅ Keyboard shortcuts: `e` edits the open article, `g` then `a` opens all articles, `g` then `h` goes home, `?` lists them. Ignored while typing or a dialog is open
- ⬜ Remaining shortcuts (`s` share, `p` print, `g i`, `g n`, `j`/`k`)

### Browse / list
- ✅ All Articles table (compact density, sortable columns, dropdown filters, search, 11 seed articles)
- ✅ My Drafts (`/kb/drafts`, Joe Clark's drafts) and Recently Updated (`/kb/recent`, not archived)
- 🟡 Shared With Me (`/kb/shared`) is an empty state until review requests exist
- ✅ Sidebar counts for All Articles, My Drafts, Shared, and Recent come from Postgres
- ✅ Category and tag indexes (`/categories`, `/tags`) and filtered article lists (`/categories/[slug]`, `/tags/[slug]`); chips link through

---

## 3. Authoring (M2)

- 🟡 Draft editor at `/create` and `/kb/[slug]/edit` — template sections, labeled command fields, callout preview and validation, metadata rail, save writes a new `ArticleVersion`
- 🟡 TipTap for overview body and step body, with bold, italic, and lists saved as HTML. Custom nodes and autosave remain
- ⬜ TipTap custom nodes (Prerequisite, Step, Verification, Callout, CodeBlock)
- ⬜ Side-by-side preview matching read view (the field editor is the first stand-in)
- ⬜ Autosave to Redis every 10s, debounced persist to Postgres
- ✅ Publish checklist (title, category, 1+ tag, summary, ≥1 step) with minor or major bump; status dropdown cannot publish on its own
- ✅ Edit entry points: article header, Quick Actions, and an Edit link on each All Articles row
- ✅ Save bumps the minor number (`1.2` → `1.3`); Publish offers minor (same bump) or major (`1.2` → `2.0`)

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
- 🟡 `Ctrl+K` palette hits articles and nav; actions and recently viewed remain
- ⬜ Facets: category, tag, status, updated-within
- ✅ Public category and tag browse pages (index + filtered article list)
- 🟡 Category admin: create, rename, and delete when the category has no articles. Merge and the color override remain
- ⬜ Tag CRUD + merge
- 🟡 Related articles: right rail lists other published articles in the same category (backfilled from the rest of the library). Lexical and embedding similarity still to do

---

## 6. Auth & admin (M5)

Decision: `Docs/specs/adr/0001-server-managed-sessions.md`. The app requires a login. A published article may be marked public and read without a session. Login, logout, password reset, the public read view, and the FastAPI assertion check are in.

Phase A:

- ✅ `auth/web` password, session, recovery, and assertion helpers (no TechBase imports). `auth/py` verifies the same 60-second HMAC token. Second-app install steps are in `auth/web/README.md`
- ✅ Postgres `auth` schema (`identity`, `session`, `email_token`, `login_attempt`, `audit_event`) and `User.identityId` — migration `20261014173850_auth_schema` applied and the Prisma client regenerated
- ✅ Password login, `__Host-tb_session` cookie, logout, and revocation. Signed in as Joe Clark on `:3001`, then signed out; `/` returns to `/login`. Session clock uses `connection()` so prerender does not call `new Date()`
- 🟡 Password reset and email verification. One-time links. Resend accepted a reset for `joe.clark@techbase.local` (2026-10-14, server log `[auth] sent`). That address is not a real inbox. Next reads `RESEND_API_KEY` and `EMAIL_FROM` from `frontend/.env`, not the backend env file. zxcvbn and the breach check remain
- ✅ Next.js gate redirects unsigned visitors to `/login`. Forgot, reset, and verify sit outside that gate. A published public article is the exception
- ✅ `Article.visibility` (`private` default). Joe Clark (admin) checked Public link on the BitLocker article and saved. Signed out, `/kb/windows-11-bitlocker-recovery-process` showed the public view (no sidebar, no edit, no related links). `/kb/servicenow-incident-integration` redirected to `/login?next=...`. Signed Joe back in
- ✅ FastAPI `GET /v1/principal` requires the 60-second HMAC assertion or an `sv_` service credential. Health stays open. Pytest 11 passed, including a token minted by `auth/web`
- ✅ Role checks from `07-security.md` on save, category admin, and the editor. Signed in as Sarah Kim (author) on `:3000`: no Admin nav, no Publish button, status is Draft or In Review, and her published article refused the editor. FastAPI still does not check roles
- ✅ Auth audit events and login rate limit (5 / 10 min, per IP and per email). Failures, successes, and lockouts append to `auth.audit_event`. The login page says to wait when the limit is hit. No admin screen lists those rows yet
- ✅ Tests (2026-10-14): `pnpm exec tsx --test` for session, recovery, login, and assertion from `frontend/` — 14 passed. Backend `uv run pytest`: 11 passed. Second-app install steps are in `auth/web/README.md`

Phase B:

- ✅ MFA and recovery codes. Optional authenticator. Setup shows a QR code the authenticator app scans; the setup key is behind “Can't scan?”. A correct password with MFA on goes to `/login/mfa` and the session cookie is set only after a 6-digit code or a recovery code. Ten one-time codes are shown once; the page clears them when the user confirms they are saved. Checked on `:3001` as Joe Clark: enroll, second step, then turn it off with a recovery code so the seed login is password-only again. The QR image for a normal account decodes back to the authenticator link. Migration `20261014211000_auth_mfa` is applied. `AUTH_MFA_KEY` lives in `frontend/.env` and is not committed.
- ✅ Passkeys are a separate sign-in. Security has “Add a passkey”; the login page has “Sign in with a passkey”. Success sets the same session cookie and does not ask for an authenticator code. Checked on `:3001`: a passkey was created with Windows Hello, then sign-out and “Sign in with a passkey” opened the app. Migration `20261014223000_auth_passkey` is applied. `AUTH_WEBAUTHN_RP_ID` and `AUTH_WEBAUTHN_ORIGIN` are in `frontend/.env` and are not committed.
- ⬜ Finer permissions and organizations. OIDC (Entra ID, Google Workspace) and SAML
- ✅ Users admin. An admin can list accounts, change a role, and turn sign-in off or on. A role change or a disable signs that person out. Self and last-admin changes are refused. Invite is later. Checked on `:3001`: Joe sees the directory and his own row has no controls. Sarah Kim’s role was changed to reviewer and put back to author. Signed in as Sarah, `/admin/users` shows the admin-only message and no controls. Joe is signed in again.
- ⬜ Settings (branding, retention, allowed domains)
- ⬜ Integrations placeholder (ServiceNow, Jira, Teams webhook)
- ⬜ Row-level permissions on drafts beyond the role matrix

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
| 2026-10-12 | Next.js 16 Suspense wrappers for `usePathname()` and `await params` | Required for instant navigation; client hooks and URL data must be inside `<Suspense>` |
| 2026-10-12 | Layouts use explicit `{ children: React.ReactNode }` instead of generated `LayoutProps` | `LayoutProps` only exists while `next dev` runs; explicit type lets `tsc` work standalone |
| 2026-10-13 | Pin Prisma to v6 (`prisma@6`, `@prisma/client@6`) | Prisma 8 RC replaced `migrate` with a platform CLI; v6 keeps `migrate dev` + `db seed` |
| 2026-10-13 | DB reads sit inside `<Suspense>`; no `dynamic` / `generateStaticParams` | `cacheComponents` rejects those route configs; Suspense is the dynamic hole |
| 2026-10-13 | shadcn `dialog` + `button` (Base UI). Init must not own `--accent` | shadcn's accent is a hover wash; TechBase accent stays cobalt `#1E6BFF` |
| 2026-10-14 | Opaque server sessions in Postgres, not a browser JWT or Auth.js | Logout and role change must revoke access. FastAPI checks a 60s HMAC assertion and does not open the auth tables. [ADR 0001](Docs/specs/adr/0001-server-managed-sessions.md) |
| 2026-10-14 | Login required, with a per-article public flag | Published + `visibility=public` is the only anonymous read. The rest of the app stays behind the session |

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
