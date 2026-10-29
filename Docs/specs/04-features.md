# 04 — Features

For each feature: **what it is**, **key screens**, **behavior**, **non-goals**. Visual decisions defer to `02-design-system.md`.

---

## F1 — App shell

**What**: Persistent dark sidebar, light top bar + canvas (both themes). Signature layout; always present inside `(app)` route group.

**Screens**: every authenticated route.

**Behavior**:
- Sidebar sections (per mock):
  - `Home`
  - `Knowledge Base` (collapsible)
    - `All Articles` + count
    - `My Drafts` + count
    - `Shared With Me` + count
    - `Recently Updated` + count
  - `Create Article` — roles that can create an article
  - `Categories`
  - `Tags`
  - `AI Assistant` (badge: `New`) — roles that can create an article
  - `Import from File` — roles that can create an article
  - `Analytics` — reviewer and admin
  - Upload File card — roles that can create an article. A reader does not see it, and `g` then `i` does not open import.
  - section header `ADMIN`
    - `Users`, `Settings`, `Integrations` (admin role only)
- Counts update live via a Server Action on route change; stale-while-revalidate from Redis.
- Upload File card is pinned to the bottom for roles that can create an article. Clicking it goes to `/import`.
- Sidebar collapsible to a 72px icon rail (persisted per user).

**Non-goals**: no drag-and-reorder of nav; no user-customizable sidebar in v1.

---

## F2 — Top bar & command palette

**What**: Universal search, notifications, theme toggle, user menu.

**Behavior**:
- Search is a disclosure trigger. Typing opens the command palette (`cmdk`) in-place rather than navigating.
- `Ctrl + K` / `⌘ + K` opens the palette from any screen.
- One list, not separate tabs.
  - **Recent** — the last 10 articles this person opened or edited, newest first. An empty query shows this list.
  - **Actions** — Create article (author and above), Import from file, Toggle theme, Keyboard shortcuts, and Analytics (reviewer and admin).
  - **Go to** — pages such as Home, All Articles, and Categories.
- Typing two or more characters searches article text and filters Actions and Go to by name.
- Notifications bell shows unread count (badge). The panel lists recent items: `ingestion_complete` (after a file import finishes), `review_requested` (when an article moves to In Review — reviewers and admins), and `mention` (seeded for now; @mentions in field notes come later). Click marks read and follows the link. Mark all read clears the badge.
- Theme toggle cycles light → dark → system.
- User menu: profile (`/account`), keyboard shortcuts (`?`), security, sign out. The avatar uses a stored `avatarUrl` when set, otherwise [Gravatar](https://gravatar.com) for the account email (SHA-256 hash, `d=identicon` when that email has no photo). Article author chips resolve the same way on the server without putting the email in the page payload.

---

## F3 — Article detail (read view) — the mock

**What**: The primary consumption view. Everything the mock shows.

**Layout**: three columns inside main area (TOC `220`, content fluid, meta `320`).

**Content order** (vertical):
1. Breadcrumbs (`Knowledge Base › Articles`).
2. Title block:
   - Category chip
   - `h1` title
   - Summary (muted)
   - Metadata row: author avatar+name, created date, read time, status chip.
   - Right side: hero image (locked aspect, `420` max).
   - Right-top: `Edit`, `Share`, overflow (`•••`). An admin also sees `Delete`. Delete asks for confirmation, then removes the article, its versions, notes, and votes. Delete is blocked while the article still has child pages (move or delete children first — see `10-page-tree.md`). Archive remains the reversible status.
3. In the right column (`TOC`), a sticky list of section titles with icon tiles. Click scrolls with `scroll-margin-top` offset.
4. Content column renders each section:
   - **Overview**: prose + optional callout.
   - **Prerequisites**: green-check checklist on a soft panel.
   - **Step-by-Step Instructions**: numbered circular badges with title, body, inline code, optional code block.
   - **Verification**: typically a checklist and/or a code block.
   - **Troubleshooting**: callouts and small sub-headings.
   - **Related Articles**: a horizontal row of related chips (also mirrored in the right rail).
5. **Right rail** (meta):
   - `Article Details` card: ID, Category, Tags, Last Updated, Created By, Version.
   - `Related Articles` card: up to four other **published** articles. Ranked by Postgres FTS against the current title, tags, and summary (`plainto_tsquery` on `searchVector`), with same-category boosted. Shortfalls fill from the same category, then the rest of the published library. Embeddings stay post-pilot.
   - `Quick Actions` card: Download as PDF, Copy Link, Print Article.
   - `Was this article helpful?` thumbs card.

**Keyboard**:
- `e` → edit (if permitted)
- `s` → share dialog
- `p` → print
- `j` / `k` → next/prev section
- `?` → shortcut cheatsheet

**Performance**:
- RSC streams in order: title block (immediate) → sections (suspense per section) → right rail (suspense).
- Code blocks are highlighted server-side via Shiki (no runtime JS highlighter).

**Non-goals**: comments anchored to a paragraph, @mentions, realtime presence. Field notes on the whole article are [11-article-notes.md](11-article-notes.md).

---

## F4 — Article list views

**Variants**: All Articles, My Drafts, Shared With Me, Recently Updated.

**Behavior**:
- Compact table default (48px rows), toggle to Comfortable.
- Columns: Title (+ category chip), Author, Tags, Status, Last Updated, Views.
- Sorting on all columns.
- Filter chips above the table: Category, Tag, Status, Updated (7d/30d/90d/all).
- Row click opens detail. `⌘-click` opens in new tab.
- Bulk selection + bulk actions (admin/reviewer): archive, change category, add tag.

---

## F5 — Create / Edit article

**Entry points**: sidebar `Create Article`, or `Edit` on an existing article, or completion of an ingestion job.

**Layout**: two-pane editor.
- Left: TipTap-based editor matching the read view styling (same section headers, same callouts, same code blocks). Prerequisites and verification checks use the green checklist mark. Steps use the cobalt badge. Callouts use the tinted panel. Commands use the dark code block.
- Main column starts with **Article title** and summary (the reader h1), then section cards. Each section card has a labeled **Section heading** (e.g. Overview) — that is not the article title.
- Right: metadata rail (category, tags, status, visibility).
- **Preview** opens a full reader layout (header, TOC, sections) from the live draft without publishing. There is no permanent preview tab; the editor stays the place you write.

**Behavior**:
- Starting a new article presents the **template** (empty sections for Overview, Prerequisites, Steps, Verification, Troubleshooting). The author can delete sections but can't invent new section kinds beyond `custom`.
- Autosave to Postgres every 10s while idle (debounced) or on window blur / tab hide. A `localStorage` mirror covers refresh before the server write finishes. Draft and in-review articles rewrite the current version in place (no version flood). Published edits write a single `wip` `draftVersion` until Save or Publish. Redis buffer is later. Status line shows Unsaved / Saving… / Saved.
- `Publish` opens a checklist dialog:
  - Title ✔
  - Category ✔
  - ≥ 1 tag ✔
  - Summary ✔
  - ≥ 1 step in Step-by-Step ✔
  - Version bump: minor / major (default minor).
- `In Review`: author can request a reviewer; reviewer sees it under `Shared With Me`.
- `Discard draft` is confirmable and reversible for 24h (soft).

---

## F6 — Import from file (ingestion)

**Entry**: sidebar `Import from File`, bottom CTA, keyboard `g i`.

**Current slice** (one file, live stepper, no queue):
1. `/import` accepts one `.docx` or `.pdf` up to 25MB.
2. The browser asks `POST /api/upload/presign`, PUTs the file to object storage, then calls `POST /api/upload/complete`. Complete creates a queued `IngestionJob` and returns `{ jobId }`. The file bytes do not go through a Next server action.
3. The import page opens an EventSource on `GET /api/jobs/{jobId}/stream` and shows the progress stepper (parse → segment → extract → validate → draft ready).
4. The stream route claims the job, calls `POST /ingest` with `Accept: text/event-stream`, and forwards stage events. Python downloads `uploads/{userId}/...` and reads it. The key has to belong to that user.
5. Python maps headings onto Overview, Prerequisites, Steps, Verification, and Troubleshooting. Any other heading stays in Overview. A numbered procedure becomes steps. Word pictures stay on the step. A PDF page that is a picture with almost no text is noted in Overview and not read.
6. When `AI_API_KEY` is set, the model structures the extracted text into the article through `AI_BASE_URL` and `AI_MODEL`. A section the text does not support stays empty. Invalid JSON gets one repair, then the parser draft is kept.
7. Next saves the draft, marks the job succeeded, emits `done` with the slug and per-stage timings, and the editor opens. The stepper shows each stage duration. `GET /api/jobs/{id}` returns the same trace. Redis streams and BullMQ are still later. On failure the page shows the reason; retry is starting the import again.

**Later** (queue + Redis stream):
1. Optional category and tags on the dropzone.
2. Complete only enqueues; a worker runs the job and writes events to Redis.
3. The SSE route proxies that Redis stream.
4. Failure offers open a blank editor or open with raw extracted text.

**Non-goals (v1)**: OCR for scanned PDFs (deferred to M+); batch multi-file import.

---

## F7 — Search

**Entry**: top bar (`Ctrl+K`), or `/kb` page filter.

**Behavior**:
- Postgres FTS (`tsvector`) with weighted fields (title A, tags B, summary B, section titles C, body D).
- `Ctrl+K` and the article-list search box query that index. Each hit shows the title and a short snippet with the matched words in bold.
- Category, status, and updated-within (7d / 30d / 90d) narrow the Postgres query on `/kb` (URL params) and the FTS query used by the list search box and `Ctrl+K` callers that pass the same params.
- Zero-result empty state suggests a broader word.

**Non-goals (v1)**: embedding-based semantic search.

---

## F8 — Categories & tags

**Admin screens**:
- **Categories**: list with article count. Admins can create, rename, merge into another category, set an optional chip color (`#RRGGBB` presets or clear to brand accent), and delete when empty. Cannot delete a category with articles — merge first.
- **Tags**: list with article count. Admins can create, rename, merge into another tag, and delete when the tag is on no articles (same delete rule as categories). Tags are flat (no hierarchy).

**Browse views** (session required):
- `/categories/[slug]` and `/tags/[slug]` show an article list filtered to that taxonomy term.

---

## F9 — Analytics

**Scope** (v1):
- Global dashboard: total articles, published, drafts, views (7d/30d), top articles by views, articles not reviewed in 12 months.
- Per-article page: views over 30 days (sparkline), helpful ratio, feedback comments.

The detail rail and the article list already show `Article.views`. Opening an article adds 1 once per signed-in user per UTC day. A public article also counts once per anonymous browser. A repeat open that day does not add another view, and the count does not change when the article was last updated. History does not count.

A reviewer or admin also sees the last 30 UTC days on the article: one point per day from `ArticleView`, zeros included, plus the helpful ratio from the article counters. That series starts when view counting shipped, so it will not add up to the lifetime total.

Analytics shows the same audience a compact dashboard: totals by status, unique opens in 7 and 30 UTC days, the five articles with the most lifetime views, and published or in-review articles last updated more than 12 months ago. There is no separate review timestamp, so staleness uses `updatedAt`. Redis HLL is later.

**Non-goals**: cohort analysis, funnel analysis, A/B testing.

---

## F10 — Admin

**Users**: an admin can add an account with a name, email, role, and password, edit a name or email, change a role, turn sign-in off or back on, and delete an account. A new password follows the same rules as a reset: 12 characters, three character classes, zxcvbn score ≥ 3, and not present in the Have I Been Pwned range API. The new account is verified, so they can sign in immediately. A role change, a sign-in disable, an email change, or a delete signs that person out. Delete reassigns their articles and versions to the admin who deleted them. An admin cannot change their own role, turn off their own sign-in, or delete themselves. The last admin who can still sign in cannot be demoted, disabled, or deleted. Invite by email comes later.

**Audit**: an admin can open `/admin/audit` and read `auth.audit_event` rows (when, action, account email, IP, client). Newest first, 50 per page. Article business `audit_log` stays a later feature.

**Settings**: an admin can set the accent color, an optional logo URL, how many days article versions are kept, and which email domains may be used when an identity provider is added. The signed-in shell uses the accent and the logo. A daily cron (and Run retention now) deletes versions older than that window, never removing the current or draft version. Password and passkey sign-in stay open. Feature flags come later.

**Integrations**:
- Admins add instances from templates (Slack, Teams, Generic webhook, ServiceNow, Jira) on `/admin/integrations`. Multiple instances per template are allowed.
- Card grid with status; Configure opens enable, name, fields, Test, and Remove.
- Slack / Teams / Generic webhook: Test posts a real payload; enabled instances with `notifyOnPublish` fan out on article publish.
- ServiceNow / Jira: store instance / catalog / project link config; live ticket import comes later.

---

## F11 — Versioning & diff

Specified in [09-version-history.md](09-version-history.md).

## F12 — Field notes

Specified in [11-article-notes.md](11-article-notes.md). A signed-in person can leave a note after running the procedure. This is not the helpful-vote comment.

A reviewer or admin opens `/kb/[slug]/history`, reads an older version, and compares it with the current one by section. An admin restores an older version as a new current version. The older rows stay. Move detection and deletion of old versions are later.

---

## F12 — Feedback

- Thumbs card on article detail. Optional comment (up to 500 chars) sent with either thumb.
- Rate-limited: 1 feedback per article per user per 7 days.
- Reviewer sees the votes on the article, behind Feedback notes, and on Analytics as a recent list. Charts and view counts stay in F9.

---

## F13 — Share

- `Share` button opens a dialog:
  - Copy link (one click).
  - Internal share (user-picker; the picked user sees it under `Shared With Me`).
  - Export as PDF (M+); initially this is in the Quick Actions card and talks to the Python service.

---

## F14 — Keyboard shortcuts (global)

| Shortcut   | Action                      |
|------------|-----------------------------|
| `Ctrl+K`   | Command palette             |
| `?`        | Show shortcut cheatsheet    |
| `g h`      | Go to Home                  |
| `g a`      | Go to All Articles          |
| `g i`      | Go to Import                |
| `g n`      | New article                 |
| `[` / `]`  | Prev / next article in list |
| `e`        | Edit current article        |
| `s`        | Share current article       |
| `p`        | Print current article       |
| `j` / `k`  | Prev / next section         |
| `t`        | Toggle theme                |

Discoverable through `?` and the command palette.

---

## F15 — Sign in and public articles

**What**: A session is required for the whole app. One published article can be opened without a session when an editor marks it public.

**Screens**: `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, and the article read view.

**Behavior**:
- Unauthenticated requests to any other page redirect to `/login` and return there after a successful sign-in.
- Login accepts email and password. Failure uses the same message for an unknown email and a wrong password.
- Sign out deletes the server session and clears the cookie.
- Forgot-password always responds the same way, whether or not the email exists. The reset link expires in one hour and works once.
- A public article is `published` and `visibility=public`. Its page shows the read view only: no sidebar, no edit or share controls, and no links to other articles.
- Drafts, in-review articles, and archived articles stay private. Reviewer and admin may change visibility.
- A reader sees published articles. An author also sees their own drafts and articles in review. A reviewer sees every article that is not archived. An admin also sees archived articles. Lists, search, the page tree, category and tag counts, and a direct link follow that rule.
- A page may also set a **page access** floor (author / reviewer / admin) that narrows who can open it; children inherit until they override. Spec: [`12-per-page-permissions.md`](12-per-page-permissions.md). Setting a floor clears `visibility=public`.

**Non-goals (Phase A)**: SSO, MFA, a user admin screen, and a public catalog or search.

---

## F16 — Per-page permissions

**What**: Narrow who may open one page; children inherit. Does not grant powers beyond the role matrix.

**Behavior**: See [`12-per-page-permissions.md`](12-per-page-permissions.md). Reviewer/admin set Inherit / Library / Role floor on the details card. Admin always passes the page gate.

**Non-goals (this slice)**: Per-user allowlists, separate edit ACLs, category-level permissions.
