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
  - `Create Article`
  - `Categories`
  - `Tags`
  - `AI Assistant` (badge: `New`)
  - `Import from File`
  - `Analytics`
  - section header `ADMIN`
    - `Users`, `Settings`, `Integrations` (admin role only)
- Counts update live via a Server Action on route change; stale-while-revalidate from Redis.
- Upload CTA card pinned to the bottom. Clicking it goes to `/import`.
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
- Notifications bell shows unread count (badge). Panel lists: ingestion-complete, review-requested, mention.
- Theme toggle cycles light → dark → system.
- User menu: profile, keyboard shortcuts (`?`), sign out.

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
   - Right-top: `Edit`, `Share`, overflow (`•••`).
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
   - `Related Articles` card.
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
- Left: TipTap-based editor matching the read view styling (same section headers, same callouts, same code blocks). It **is** the preview; there is no separate preview tab.
- Right: structure sidebar: section list with drag handles, add-section button, metadata (title, summary, category, tags, hero), publish status.

**Behavior**:
- Starting a new article presents the **template** (empty sections for Overview, Prerequisites, Steps, Verification, Troubleshooting). The author can delete sections but can't invent new section kinds beyond `custom`.
- Autosave to Redis every 10s (debounced), persisted draft to Postgres every 60s or on blur.
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

**First slice** (Word only):
1. `/import` accepts one `.docx` up to 25MB. A PDF is refused.
2. Next.js checks `article.create`, then sends the file to `POST /v1/parse/docx` with the 60-second assertion.
3. Python maps headings onto Overview, Prerequisites, Steps, Verification, and Troubleshooting. Any other heading stays in Overview.
4. If Overview, Verification, or Troubleshooting is missing, and `AI_API_KEY` is set, the service writes the missing sections from the extracted steps through `AI_BASE_URL` and `AI_MODEL`. A section already in the file is kept.
5. The draft is saved and the editor opens. There is no S3 upload and no progress stepper in this slice.

**Target flow** (after the first slice):
1. Dropzone: accepts `.docx`, `.pdf` up to 25MB.
2. Pick category (optional), add tags (optional). These seed the extractor but don't override its structural work.
3. Click `Start`. Client requests presigned PUT, uploads to S3, calls `POST /api/upload/complete`.
4. UI transitions to a **progress stepper**:
   - Parsing document…
   - Segmenting content…
   - Extracting structure…
   - Validating…
   - Draft ready.
5. Progress is streamed via SSE from `/api/jobs/{id}/stream`.
6. On success, navigates to the new draft in the editor with a toast: "Drafted from `filename.docx`. Review and publish."
7. On failure, UI shows the failure reason and offers:
   - Retry
   - Open a blank editor
   - Open with raw extracted text (editor pre-filled with everything in a single Overview section — nothing is lost).

**Non-goals (v1)**: OCR for scanned PDFs (deferred to M+); batch multi-file import.

---

## F7 — Search

**Entry**: top bar (`Ctrl+K`), or `/kb` page filter.

**Behavior**:
- Postgres FTS (`tsvector`) with weighted fields (title A, tags B, summary B, section titles C, body D).
- `Ctrl+K` and the article-list search box query that index. Each hit shows the title and a short snippet with the matched words in bold.
- The list still applies category, status, and date filters after the search. Pushing those filters into the FTS query is later.
- Zero-result empty state suggests a broader word.

**Non-goals (v1)**: embedding-based semantic search.

---

## F8 — Categories & tags

**Admin screens**:
- **Categories**: list with article count, create/rename/merge, optional color override. Cannot delete a category with articles — must merge first.
- **Tags**: list with article count, create/rename/merge/delete. Tags are flat (no hierarchy).

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

**Users**: an admin can add an account with a name, email, role, and password, edit a name or email, change a role, turn sign-in off or back on, and delete an account. A new password follows the same rules as a reset: 12 characters and three character classes. The new account is verified, so they can sign in immediately. A role change, a sign-in disable, an email change, or a delete signs that person out. Delete reassigns their articles and versions to the admin who deleted them. An admin cannot change their own role, turn off their own sign-in, or delete themselves. The last admin who can still sign in cannot be demoted, disabled, or deleted. Invite by email comes later.

**Settings**: an admin can set the accent color, an optional logo URL, how many days article versions are kept, and which email domains may be used when an identity provider is added. The signed-in shell uses the accent and the logo. Versions are not deleted yet, and password and passkey sign-in stay open. Feature flags come later.

**Integrations** (placeholders in v1):
- ServiceNow: outbound link from article to a Service Catalog item.
- Jira: cite an article from a Jira ticket; show inbound links on the article's Related panel.
- Teams: on publish, post to a configurable channel.

Each integration page shows: enable toggle, config form, connection test, last-sync timestamp.

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

**Non-goals (Phase A)**: SSO, MFA, a user admin screen, and a public catalog or search.
