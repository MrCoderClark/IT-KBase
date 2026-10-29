# TechBase — Progress Tracker

> Living document. Update on every meaningful change. Keep entries terse — one line each. Link to specs/PRs rather than restating them.

Last updated: 2026-10-29 (feat/version-retention)

Build order for what is left: [Docs/suggested-order.md](Docs/suggested-order.md). Check an item there when it ships, and move the matching line in this file.

Legend: `✅ done` · `🟡 in-progress` · `⬜ todo` · `⛔ blocked` · `🧪 experimental`

---

## 0. Milestones

| # | Milestone                           | Target        | Status |
|---|-------------------------------------|---------------|--------|
| M0 | Foundations: specs + repo scaffold | Week 1        | 🟡     |
| M1 | Article detail view matches mock   | Week 3        | ✅ (detail, shortcuts, avatar/Gravatar, notifications) |
| M2 | Create / edit article (manual)     | Week 4        | ✅ (nodes, autosave, reader preview) |
| M3 | Word/PDF ingestion → draft article | Week 6        | 🟡 (stored file + job + stepper + stage timings; Redis queue remains) |
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
- ✅ Upload CTA card (bottom of sidebar) with gradient treatment. Hidden, with AI Assistant and Import, unless the role can create an article. Analytics stays reviewer and admin.
- ✅ Article lists, search, the page tree, and a direct link follow the role. A reader sees published articles. An admin also sees archived articles.
- ✅ Home brief: published count, your drafts (links to `/kb/drafts`), in-review count, and the five newest articles
- ✅ Top bar: layout + bell + theme toggle; search opens the command palette. Avatar menu with Profile / shortcuts / security / sign out + Gravatar. Checked 2026-10-28.
- ✅ Light / dark theme toggle (persists in `localStorage`, no FOUC via pre-paint script)
- ✅ Command palette (`cmdk`): `Ctrl+K` and the top-bar search find articles by title, category, and tag, and jump to Home, Knowledge Base, Create, Categories, and Tags
- ✅ Command palette actions (create, import, theme, shortcuts, analytics) and recent 10 articles
- ✅ User menu: Profile, Keyboard shortcuts, Security, Sign out; Gravatar identicon (or photo) for account email. Checked 2026-10-28.
- ✅ Notifications panel: unread badge, list, mark read / mark all. Import-complete and review-requested emit; mention seeded. Checked 2026-10-28.

### Article detail view
- ✅ Breadcrumbs (`Knowledge Base > Articles`)
- ✅ Title block (category chip, h1 title, summary, metadata row with dot separators)
- ✅ Hero image slot (right-aligned, 16/10 aspect ratio, gradient placeholder)
- ✅ Edit and Share (copies the article link). Overflow stays a stub
- ✅ An admin can delete an article from the list or the article page. Delete asks for confirmation, then removes the article and its versions. Child pages stay.
- ✅ In-article table of contents (sticky left rail, 210px, IntersectionObserver active tracking)
- ✅ Section renderers: Overview, Prerequisites (checklist), Steps (numbered badges), Verification, Troubleshooting, Related
- ✅ Callout component (Info, Important, Warning, Success) — 4 variants, left-border tinted panels
- ✅ Code block with copy affordance (dark `#0B1220`, monospace, language label)
- ✅ Right rail: Article Details, Related Articles (same category, then other published articles), Quick Actions, Was-this-helpful (sticky, 300px)
- ✅ Article types (`lib/types/article.ts`) and seed data (`lib/seed/articles.ts`)
- ✅ Minimal All Articles page (`/kb`) linking to seed article
- ✅ Keyboard shortcuts: `e` edits, `g a` / `g h` / `g i`, `?` lists them. Ignored while typing or a dialog is open
- ✅ Article shortcuts: `s` share (copy link), `p` print, `j`/`k` next/prev section. Checked 2026-10-27. `g n`, `t`, `[`/`]` remain later

### Browse / list
- ✅ All Articles table (compact density, sortable columns, dropdown filters, search, 11 seed articles)
- ✅ My Drafts (`/kb/drafts`, Joe Clark's drafts) and Recently Updated (`/kb/recent`, not archived)
- 🟡 Shared With Me (`/kb/shared`) is an empty state until review requests exist
- ✅ Sidebar counts for All Articles, My Drafts, Shared, and Recent come from Postgres
- ✅ Category and tag indexes (`/categories`, `/tags`) and filtered article lists (`/categories/[slug]`, `/tags/[slug]`); chips link through

---

## 3. Authoring (M2)

- 🟡 Draft editor at `/create` and `/kb/[slug]/edit` — template sections, TipTap section nodes, metadata rail, Save writes a new `ArticleVersion`
- 🟡 TipTap for overview body and step body, with bold, italic, and lists saved as HTML
- ✅ TipTap custom nodes (checklist item, step, callout, code block) match the read view. Checked 2026-10-27 on Reset Local Admin Password edit.
- ✅ Reader preview dialog from the editor (same header/TOC/content as `/kb/[slug]`). Article title promoted to the main column. Checked 2026-10-27.
- ✅ Autosave: 10s debounce + blur/pagehide flush to Postgres, `localStorage` mirror, Autosaved chip. In-place for drafts; `wip` draftVersion for published. Redis later. Checked 2026-10-27.
- ✅ Publish checklist (title, category, 1+ tag, summary, ≥1 step) with minor or major bump; status dropdown cannot publish on its own
- ✅ Edit entry points: article header, Quick Actions, and an Edit link on each All Articles row
- ✅ Save bumps the minor number (`1.2` → `1.3`); Publish offers minor (same bump) or major (`1.2` → `2.0`)

---

## 4. Ingestion (M3)

- 🟡 `/import` accepts one `.docx` or `.pdf` up to 25MB. A scanned PDF page is noted and not read. OCR is later.
- ✅ S3 presigned-upload flow. The browser PUTs the file. `TB_S3_*` lives on the Python service. Checked 2026-10-27: `Scan_To_Network_Share.docx` landed in the `uploads` bucket.
- ✅ `POST /ingest` reads that object, returns `jobId` and the draft. Next saves the article and links the job. No queue yet. Checked on `/kb/scan-to-network-share` (draft, overview, eight steps).
- ✅ Live progress via SSE (parse → segment → extract → validate → draft ready). Stream route runs the job and proxies Python. Checked 2026-10-27 on Reset Local Admin Password. Redis stream persistence is later.
- 🟡 Word parse returns a draft and the editor opens. A numbered procedure becomes steps and keeps pictures with the step. Re-import to see it; the first upload of the OneDrive file was one overview block
- 🟡 Python: DOCX parser (`POST /v1/parse/docx`, headings → sections). Pytest passed. Service starts on port 8080 (`auth-py` is a path dependency)
- 🟡 Python: PDF parser (`POST /v1/parse/pdf`, pdfplumber). A picture page is noted. A text PDF was checked in the browser. A scan was not. Unstructured fallback is later.
- 🟡 Heading map is inside the docx parser. The fuller segmenter that only suggests kinds to an LLM is later
- 🟡 The model structures the extracted text into the article. A section the text does not support stays empty. Invalid JSON gets one repair, then the parser draft is kept.
- ✅ Python: one repair pass on invalid structure JSON. The rest of the validator in the spec is later.
- ⬜ Python: emit progress events to Redis stream
- ✅ Observability: per-stage timings on the job (`IngestionJob.trace`) and on the import stepper. Checked 2026-10-27. Full S3 artifact bundle and OpenTelemetry are later.

---

## 5. Search & taxonomy (M4)

- ✅ Postgres FTS. `Ctrl+K` and the article list search title, summary, tags, and the current version's text, and show a short snippet. Category, status, and updated-within also narrow FTS when passed. Checked on `:3001` as Joe Clark: "net user" found the local administrator article from the command in the steps, and "BitLocker" ranked the BitLocker article ahead of the password article that only mentions it in troubleshooting. Semantic search is later.
- ✅ `Ctrl+K` palette. An empty query lists the last 10 articles this person opened or edited, then actions (create, import, theme, keyboard shortcuts, analytics for a reviewer) and pages. Typing still searches article text and filters those actions and pages by name. Closing the palette clears the query. Checked on `:3001` as Joe Clark: Recent led with the local administrator article, "dark" switched the theme and the top bar followed, and "bitlocker" still opened on the BitLocker article. Theme was put back to light.
- ✅ Facets: category, status, updated-within on `/kb` (URL) and FTS. Checked 2026-10-28. Tag facet still open.
- ✅ Public category and tag browse pages (index + filtered article list)
- ✅ Category admin: create, rename, merge, color, delete-when-empty. Checked 2026-10-28 on `/categories`.
- ✅ Tag admin: create, rename, merge, delete-when-empty. Checked 2026-10-28 on `/tags`.
- ✅ Related articles: FTS rank (title/tags/summary) with same-category boost; category/library fill for shortfalls. Checked 2026-10-28. Embeddings and curated links still later.

---

## 6. Auth & admin (M5)

Decision: `Docs/specs/adr/0001-server-managed-sessions.md`. The app requires a login. A published article may be marked public and read without a session. Login, logout, password reset, the public read view, and the FastAPI assertion check are in.

Phase A:

- ✅ `auth/web` password, session, recovery, and assertion helpers (no TechBase imports). `auth/py` verifies the same 60-second HMAC token. Second-app install steps are in `auth/web/README.md`
- ✅ Postgres `auth` schema (`identity`, `session`, `email_token`, `login_attempt`, `audit_event`) and `User.identityId` — migration `20261014173850_auth_schema` applied and the Prisma client regenerated
- ✅ Password login, `__Host-tb_session` cookie, logout, and revocation. Signed in as Joe Clark on `:3001`, then signed out; `/` returns to `/login`. Session clock uses `connection()` so prerender does not call `new Date()`
- ✅ Password reset and email verification. One-time links. Resend accepted a reset for `joe.clark@techbase.local` (2026-10-14, server log `[auth] sent`). That address is not a real inbox. Next reads `RESEND_API_KEY` and `EMAIL_FROM` from `frontend/.env`, not the backend env file. zxcvbn ≥ 3 (brand dictionary) and HIBP range check on reset and admin create; policy hint on those forms. Checked 2026-10-28.
- ✅ Next.js gate redirects unsigned visitors to `/login`. Forgot, reset, and verify sit outside that gate. A published public article is the exception
- ✅ `Article.visibility` (`private` default). Joe Clark (admin) checked Public link on the BitLocker article and saved. Signed out, `/kb/windows-11-bitlocker-recovery-process` showed the public view (no sidebar, no edit, no related links). `/kb/servicenow-incident-integration` redirected to `/login?next=...`. Signed Joe back in
- ✅ FastAPI `GET /v1/principal` requires the 60-second HMAC assertion or an `sv_` service credential. Health stays open. Pytest 11 passed, including a token minted by `auth/web`
- ✅ Role checks from `07-security.md` on save, category admin, and the editor. Signed in as Sarah Kim (author) on `:3000`: no Admin nav, no Publish button, status is Draft or In Review, and her published article refused the editor. FastAPI repeats the same capability matrix in `backend/policy.py` on ingest and parse. Checked 2026-10-28.
- ✅ Auth audit events and login rate limit (5 / 10 min, per IP and per email). Failures, successes, and lockouts append to `auth.audit_event`. The login page says to wait when the limit is hit. Admin list on `/admin/audit`. Checked 2026-10-28.
- ✅ Tests (2026-10-14): `pnpm exec tsx --test` for session, recovery, login, and assertion from `frontend/` — 14 passed. Backend `uv run pytest`: 11 passed. Second-app install steps are in `auth/web/README.md`

Phase B:

- ✅ MFA and recovery codes. Optional authenticator. Setup shows a QR code the authenticator app scans; the setup key is behind “Can't scan?”. A correct password with MFA on goes to `/login/mfa` and the session cookie is set only after a 6-digit code or a recovery code. Ten one-time codes are shown once; the page clears them when the user confirms they are saved. Checked on `:3001` as Joe Clark: enroll, second step, then turn it off with a recovery code so the seed login is password-only again. The QR image for a normal account decodes back to the authenticator link. Migration `20261014211000_auth_mfa` is applied. `AUTH_MFA_KEY` lives in `frontend/.env` and is not committed.
- ✅ Passkeys are a separate sign-in. Security has “Add a passkey”; the login page has “Sign in with a passkey”. Success sets the same session cookie and does not ask for an authenticator code. Checked on `:3001`: a passkey was created with Windows Hello, then sign-out and “Sign in with a passkey” opened the app. Migration `20261014223000_auth_passkey` is applied. `AUTH_WEBAUTHN_RP_ID` and `AUTH_WEBAUTHN_ORIGIN` are in `frontend/.env` and are not committed.
- ⬜ Finer permissions and organizations. OIDC (Entra ID, Google Workspace) and SAML
- ✅ Users admin. Add an account, edit a name or email, change a role, turn sign-in off, and delete. A new password follows the reset rules. Delete asks for the email and reassigns articles to the acting admin. Self and last-admin changes are refused. Invite by email is later. Checked on `:3001`: added Casey Nguyen, renamed them, then deleted the account. Seeded users are unchanged.
- ✅ Settings. An admin can set the accent, an optional logo URL, how long versions are kept, and allowed email domains. The signed-in shell uses the accent. Sign-in is unchanged. Checked on `:3001`: a teal accent and 90-day retention saved, the Save button used that color after refresh, then both were put back to the defaults. Migration `20261015160000_site_setting` is applied. Version retention: daily cron + Run retention now; current/draft kept. Checked 2026-10-29.
- ✅ Security headers. Next.js 16 `proxy.ts` sets HSTS, CSP (nonce + theme sha256 + strict-dynamic), Referrer-Policy, Permissions-Policy, nosniff, and X-Frame-Options DENY. Public `/kb` rewrite kept. Checked 2026-10-28.
- ✅ Integrations shell. `/admin/integrations` saves enable + config for ServiceNow, Jira, Teams, and Slack; Test records a stub attempt. Live calls wait. Migration `20261028210000_integration_setting`. Checked 2026-10-29.
- ⬜ Row-level permissions on drafts beyond the role matrix

---

## 7. Feedback, analytics, versioning (M6)

- ✅ Thumbs up/down + optional comment. One vote per person per article each week. A reviewer reads the notes on the article and on Analytics. Checked on `:3001` as Joe Clark: a helpful vote on BitLocker raised the count from 156 to 157, saved the comment, and blocked another vote until Oct 26. The same vote is on Analytics.
- ✅ View counting. One open per signed-in user per UTC day, or per anonymous browser on a public article, adds 1 to `Article.views`. A second open the same day does not. The count does not change the article's updated time, and history does not count. Checked on `:3001` as Joe Clark: Defender went from 54 to 55, DHCP scope exhaustion from 12 to 13, and a reload stayed at 13. Both still show Oct 14 in the article list. An anonymous open of public BitLocker counted once (1893 to 1894); a second open and a private article without a session did not. Redis HLL is later.
- ✅ Article analytics. A reviewer or admin sees the last 30 UTC days and the helpful ratio on the article. The series is daily unique opens, so it does not add up to the lifetime view total. Checked on `:3001` as Joe Clark: Defender showed 1 view on Oct 19 and 55 lifetime views, with 100% helpful (3 of 3). The global dashboard is later.
- ✅ Global analytics dashboard. A reviewer or admin sees status counts, unique opens in 7 and 30 days, the top five articles by lifetime views, and published or in-review articles not updated in 12 months. Checked on `:3001` as Joe Clark: 12 articles (9 published, 1 in review, 2 drafts, 0 archived), 8 unique opens in both windows, Active Directory at the top with 2,103 views, and no article older than 12 months.
- ✅ Version history. Spec is `Docs/specs/09-version-history.md`. A reviewer or admin can read an older version and compare sections in order. An admin restores a version as a new current row; older rows stay. Checked on `:3001` as Joe Clark: restored DNS cache 1.6 as 1.8, then restored 1.7 as 1.9 so the live article matches the text that was current before the check.

---

## 7b. Confluence-like features

These turn TechBase from a flat article list into a structured knowledge system. Build in order — each depends on the previous.

| # | Feature | Spec | Status |
|---|---------|------|--------|
| 1 | **Version history** | `09-version-history.md` | ✅ History list, read older version, section compare, restore |
| 2 | **Page tree** | `10-page-tree.md` | ✅ Sidebar tree, breadcrumbs, Add child, nest/reorder, promote to root, delete blocked with children. Checked 2026-10-28 |
| 3 | **Field notes** | `11-article-notes.md` | ✅ Post and delete checked on an article. Replies and @mentions wait |
| 4 | **Per-page permissions** | `12-per-page-permissions.md` | ✅ Inherit / library / role_floor; enforced on detail, lists, tree, search. Checked 2026-10-28 |

Next: item 24 in [Docs/suggested-order.md](Docs/suggested-order.md), CI. A scanned page was not tried. Redis queue remains later.

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
