# Suggested build order

Follow this top to bottom. One item is one branch. When an item is done, check it here and move the matching line in `progress.md`.

`progress.md` is the record of what already shipped. This file is only the order of what is left. Specs stay the source of truth for behavior. The milestone table at the top of `progress.md` is behind the detailed sections. M4, M5, and M6 are mostly built.

Do not start an item further down because it looks smaller. The ingestion path is the one the specs still call the product.

## 1. Finish ingestion

Word import already lands a draft, keeps pictures on numbered steps, and fills a blank Overview, Verification, and Troubleshooting. Spec: `Docs/specs/05-ai-ingestion.md`.

1. **PDF into the same draft.** Accept one `.pdf` on Import the way `.docx` works now. `pdfplumber` first. No object storage and no progress stepper in this step. A scanned page with no text stays a noted gap. OCR is post-pilot.
2. **Structure call with one repair.** Replace the "fill the blank sections" call with the `KBExtractor` step in the spec. Invalid model output gets one repair, then a draft a person can fix. A section already in the file is still kept.
3. **Store the file, then start a job.** Upload to object storage, then `POST /ingest` returns a job id. The browser no longer holds the whole file in the server action.
4. **Live progress.** The import screen shows parse, extract, structure, and validate while the job runs. Events come from the Redis stream in the spec.
5. **One traced run.** A single Word or PDF import can be followed from the upload to the draft, with a timing per stage.

## 2. Finish the editor

The field editor already saves versions. Publish already checks title, category, tag, summary, and one step. Spec: `Docs/specs/04-features.md` F5.

6. **Custom section nodes.** Prerequisites, steps, verification, callouts, and code are real editor nodes, not only labeled fields.
7. **Autosave.** A draft is kept while the author is typing, then written to Postgres. Leaving the page does not drop the last edit.
8. **Read-view preview.** The author can see the article the way a reader will, without publishing.

## 3. Finish the article page and the shell

9. **Remaining shortcuts.** `s` shares, `p` prints, `j` and `k` move between sections. `e`, `g a`, `g h`, `g i`, and `?` already exist.
10. **Avatar menu.** Profile and the shortcut list live next to Sign out.
11. **Notifications.** The bell opens real items. Until this exists it stays a stub.

## 4. Finish find and organize

Search, category pages, and tag pages already work. Spec: `Docs/specs/04-features.md` F4 and the search section.

12. **Tags.** Create, rename, and merge tags. Delete stays blocked while a tag is on an article, same rule as categories.
13. **Category merge and color.** Create, rename, and delete-when-empty already work.
14. **Filters inside search.** Category, status, and updated-within narrow the database query, not only the rows already on screen.
15. **Related articles by the text.** The right rail can use more than "same category, then the rest." Embeddings stay post-pilot.

## 5. Finish the page system

16. **Page tree leftovers.** Sibling reorder and moving a page back to the top level, if a pass through `Docs/specs/10-page-tree.md` still shows them open.
17. **Per-page permissions.** Write the spec first. Then a page can narrow who sees it, and a child inherits that rule. This is item 4 in `progress.md` section 7b.

Field-note replies and @mentions wait. `Docs/specs/11-article-notes.md` already says so.

## 6. Finish auth and admin

Login, roles, MFA, passkeys, users, and settings already work. Spec: `Docs/specs/07-security.md` and `Docs/specs/08-roadmap.md` Phase B.

18. **Password strength.** zxcvbn and the breach check on the rules already written for reset and new accounts.
19. **FastAPI repeats the role check.** The Python service does not trust the Next.js check alone.
20. **Audit list.** An admin can read `auth.audit_event`. The rows are already written.
21. **Security headers.** CSP, HSTS, and the rest of the header list in `Docs/specs/07-security.md`.
22. **Integrations shell.** ServiceNow, Jira, and a Teams webhook are a placeholder an admin can open. No live ticket import yet.
23. **Version retention.** Settings already stores how long versions are kept. This step is the job that actually deletes expired rows.

## 7. Hardening, then pilot

24. **CI.** Lint, typecheck, and test on a pull request for the web app and the Python service.
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
