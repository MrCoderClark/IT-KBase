# Suggested build order

Follow this top to bottom. One item is one branch. When an item is done, check it here and move the matching line in `progress.md`.

`progress.md` is the record of what already shipped. This file is only the order of what is left. Specs stay the source of truth for behavior. The milestone table at the top of `progress.md` is behind the detailed sections. M4, M5, and M6 are mostly built.

Do not start an item further down because it looks smaller. The ingestion path is the one the specs still call the product.

## 1. Finish ingestion

Word import already lands a draft, keeps pictures on numbered steps, and fills a blank Overview, Verification, and Troubleshooting. Spec: `Docs/specs/05-ai-ingestion.md`.

1. **PDF into the same draft.** Accept one `.pdf` on Import the way `.docx` works now. `pdfplumber` first. No object storage and no progress stepper in this step. A scanned page with no text stays a noted gap. OCR is post-pilot.
2. **Structure call with one repair.** Replace the "fill the blank sections" call with the `KBExtractor` step in the spec. Invalid model output gets one repair, then a draft a person can fix. A section already in the file is still kept.
3. ✅ **Store the file, then start a job.** Checked 2026-10-27. `Scan_To_Network_Share.docx` was stored, `POST /ingest` returned the job, and `/kb/scan-to-network-share` opened as a draft with an overview and eight steps. The stepper is item 4.
4. ✅ **Live progress.** Checked 2026-10-27. `Reset Local Computer Account Passwordv2.docx` moved through the stepper and opened `/kb/reset-local-admin-password` as a draft. Redis streams wait for the queue.
5. ✅ **One traced run.** Checked 2026-10-27. Stage durations show on the import stepper, land on `IngestionJob.trace`, and return from `GET /api/jobs/{id}`. Full S3 artifact and OpenTelemetry wait.

## 2. Finish the editor

The field editor already saves versions. Publish already checks title, category, tag, summary, and one step. Spec: `Docs/specs/04-features.md` F5.

6. ✅ **Custom section nodes.** Checked 2026-10-27 on `/kb/reset-local-admin-password/edit`. Checklist items use the green mark; steps, callouts, and code blocks use TipTap nodes matching the read view.
7. ✅ **Autosave.** Checked 2026-10-27. Edits autosave to Postgres (~10s / blur) with a visible Autosaved chip; refresh keeps the last edit via localStorage. Redis buffer later.
8. ✅ **Read-view preview.** Checked 2026-10-27. Preview opens the reader layout from the live draft without publishing. Article title sits at the top of the editor so it is not confused with a section heading.

## 3. Finish the article page and the shell

9. ✅ **Remaining shortcuts.** Checked 2026-10-27. `s` shares, `p` prints, `j`/`k` move between sections. `e`, `g a`, `g h`, `g i`, and `?` already existed.
10. ✅ **Avatar menu.** Checked 2026-10-28. Profile, Keyboard shortcuts, Security, and Sign out. Gravatar (SHA-256, identicon fallback) for the account email and article author chips.
11. ✅ **Notifications.** Checked 2026-10-28. Bell lists import finished, review requested, and mention (seeded); unread badge, mark read / mark all.

## 4. Finish find and organize

Search, category pages, and tag pages already work. Spec: `Docs/specs/04-features.md` F4 and the search section.

12. ✅ **Tags.** Checked 2026-10-28. Create, rename, and merge on `/tags`. Delete stays blocked while a tag is on an article.
13. ✅ **Category merge and color.** Checked 2026-10-28. Merge and optional chip color on `/categories`; delete stays blocked while a category has articles.
14. ✅ **Filters inside search.** Checked 2026-10-28. Category, status, and updated-within narrow `/kb` (URL) and FTS, not only the rows already on screen.
15. ✅ **Related articles by the text.** Checked 2026-10-28. Right rail ranks by FTS (title/tags/summary) with same-category boost; category/library fill for shortfalls. Embeddings stay post-pilot. Manual curated links not in this step.

## 5. Finish the page system

16. ✅ **Page tree leftovers.** Checked 2026-10-28. Sibling reorder, root drop strips to promote to top level, contiguous order rewrite, delete blocked while children exist.
17. ✅ **Per-page permissions.** Checked 2026-10-28. Inherit / library / role_floor on the article details card; children inherit; lists, tree, and search enforce the gate.

Field-note replies and @mentions wait. `Docs/specs/11-article-notes.md` already says so.

## 6. Finish auth and admin

Login, roles, MFA, passkeys, users, and settings already work. Spec: `Docs/specs/07-security.md` and `Docs/specs/08-roadmap.md` Phase B.

18. ✅ **Password strength.** Checked 2026-10-28. zxcvbn ≥ 3 (with TechBase brand terms) and HIBP on reset and admin create; rules listed on those forms.
19. ✅ **FastAPI repeats the role check.** Checked 2026-10-28. `backend/policy.py` mirrors the Next.js capability matrix; ingest and parse require `article.create`.
20. ✅ **Audit list.** Checked 2026-10-28. `/admin/audit` lists `auth.audit_event` for admins; loopback peers show a LAN IPv4.
21. ✅ **Security headers.** Checked 2026-10-28. `proxy.ts` sets HSTS, CSP (nonce + theme sha256 + strict-dynamic), Referrer-Policy, Permissions-Policy, nosniff, and X-Frame-Options DENY.
22. ✅ **Integrations shell.** Checked 2026-10-29. `/admin/integrations` saves enable + config for ServiceNow, Jira, Teams, and Slack; Test is a stub. Live calls wait.
23. ✅ **Version retention.** Checked 2026-10-29. Daily cron + Settings “Run retention now” purge versions older than `versionRetentionDays`; current and draft rows are kept.

## 6b. Live integrations (after the shell)

- ✅ **Slack publish webhook.** Checked 2026-10-29. Real Test + post on publish when Slack is enabled.
- ✅ **Modular integrations UI.** Checked 2026-10-29. Catalog templates + DB-owned instances; Add via UI; Generic webhook; publish fan-out.

## 7. Hardening, then pilot

24. ✅ **CI.** Checked 2026-10-29 locally. GitHub Actions on PR/main: frontend lint + typecheck + `tsx --test`; backend ruff + pytest.
25. **Generated API client.** TypeScript types come from the Python OpenAPI schema.
26. **Seed.** Grow the library from 11 articles toward the ~20 realistic IT articles in `progress.md`.
27. **Stack ADR.** Write `Docs/specs/adr/0002-stack-choices.md` for the decisions already in `claude.md`.
28. **Accessibility.** axe-core clean on the main routes, plus a keyboard-only pass.
29. **Lighthouse.** Performance at least 90, accessibility at least 95, best practices at least 95 on the article page.
30. **Visual check.** Screenshot comparison on the article view.
31. **Load.** 100 concurrent ingestions, and the article page under the rate in `Docs/specs/08-roadmap.md`.
32. **Security review.** OWASP ASVS level 1.
33. **Pilot.** Import real Word and PDF runbooks, sit with the IT team, and write the go or no-go note.

## Decide before the pilot, do not build yet

- Single tenant for the pilot, or a tenant id from day one.
- Which model is primary in production. The interface stays pluggable either way.
- Whether Entra ID or another SSO login is required for the pilot.

## After the pilot

From `Docs/specs/08-roadmap.md`. Not part of the order above.

- Semantic search and embeddings
- OCR for scanned PDFs
- Multi-tenant mode
- Realtime co-editing
- Draft an article from a URL
- Ticket import from Jira or ServiceNow
- Review reminders for stale articles
- AI Assistant grounded in the open article
- A native mobile app
- A public portal with a curated subset

SSO (OIDC and SAML) is in the auth spec as a later phase. Build it only if the pilot decision above says it is required.
