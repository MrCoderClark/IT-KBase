# 00 — Product Overview

## Vision

**TechBase** is the knowledge base IT teams actually use. It eats the Word documents, PDFs, and runbooks that live in SharePoint and shared drives, and turns them into structured, versioned, searchable articles that an on-call engineer can scan at 2am without squinting.

It is not a general wiki. It is not a customer-facing help center. It is a **purpose-built tool for internal IT**, with opinions about structure (every article has Overview / Prerequisites / Steps / Verification / Troubleshooting), opinions about voice (direct, imperative, no filler), and opinions about workflow (ingest → review → publish → measure).

## Why it exists

IT knowledge rots in three ways:

1. **It's scattered.** Confluence, SharePoint, OneNote, Teams chats, Jira comments, a `D:\IT\RUNBOOKS` folder.
2. **It's shaped wrong.** A 14-page Word doc with a title page and a legal footer is unusable at 2am.
3. **It's stale.** Nobody rewrites a 2019 "resetting the local admin password" doc for Windows 11 — they just hope someone remembers.

TechBase addresses all three: **centralize** (one app), **restructure** (AI-assisted ingestion into the canonical article shape), and **surface staleness** (last-updated, version, review cadence).

## Personas

### P1 — Joe, IT Administrator (primary)

- 10+ years in IT ops. Comfortable with PowerShell, Bash, AD, Intune, M365.
- Writes a few articles a month, consumes dozens.
- Hates ceremony. Loves keyboard shortcuts, dense tables, and copy-pasteable commands.
- Measures success by **time-to-resolution** for the person on the other end of the ticket.

### P2 — Priya, IT Manager / KB Owner

- Owns the "quality" of the KB. Reviews, publishes, archives.
- Cares about coverage (do we have articles for the top-50 ticket categories?) and freshness (what hasn't been touched in 12 months?).
- Lives in the Analytics view.

### P3 — Sam, Helpdesk L1

- First year in IT. Searches far more than they write.
- Lives in `Ctrl+K`.
- Occasionally submits a draft from a resolved ticket; a reviewer promotes it.

### P4 — Admin / IT Director (secondary)

- Approves integrations (ServiceNow, Jira, Teams).
- Looks at the dashboard quarterly.
- Needs SSO, audit log, and a defensible retention policy.

## Design principles

1. **Scan before read.** Every screen must be comprehensible in under 3 seconds of glancing.
2. **Keyboard-first.** Nothing important requires a mouse. `Ctrl+K` is the front door.
3. **Opinionated structure beats blank page.** New articles start as a filled template, not an empty document.
4. **The AI is a drafting assistant, not an author.** It proposes; a human publishes.
5. **Density without clutter.** Compact, but with air where it matters (section headers, callouts).
6. **Monochrome by default, color with intent.** Color communicates status, not decoration.
7. **Fast on real hardware.** Target TTI < 2s on a 2020 laptop over corporate VPN.
8. **No lorem ipsum. Ever.** Including in demos, seed data, and screenshots.

## Scope — in

- Ingesting DOCX and PDF into structured articles
- Manual authoring in a TipTap editor matching the read view
- Search, categories, tags, related articles
- Versioning and rollback
- Roles: reader, author, reviewer, admin
- Analytics: views, helpful ratio, staleness
- SSO (OIDC) for enterprise
- Integrations surface: ServiceNow / Jira / Teams webhook (M+)

## Scope — out (for v1)

- Public / customer-facing portal
- Multi-language translation
- Realtime co-editing (CRDT)
- Mobile native apps (responsive web is fine)
- Marketplace of community articles

## Success metrics

| Metric                                | Target (6 months post-pilot) |
|---------------------------------------|------------------------------|
| Weekly active IT users                | 80% of IT org                |
| Articles ingested from DOCX/PDF       | ≥ 150                        |
| Median time to resolve a KB-covered ticket | −20% vs baseline        |
| % articles reviewed in last 12 months | ≥ 85%                        |
| Lighthouse Perf on article view       | ≥ 90                         |
| axe-core violations on key routes     | 0                            |
