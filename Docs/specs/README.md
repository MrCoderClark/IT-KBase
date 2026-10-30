# TechBase Specs

Numbered specs are the source of truth for product, design, and engineering. Read in order.

| # | File                        | What                                                         |
|---|-----------------------------|--------------------------------------------------------------|
| 00 | `00-overview.md`           | Vision, personas, principles, scope, success metrics         |
| 01 | `01-architecture.md`       | System diagram, services, data flow, rendering, deploys      |
| 02 | `02-design-system.md`      | Tokens, components, motion, voice — the look and feel rules  |
| 03 | `03-data-model.md`         | Postgres schema, Redis layout, shared `ArticleDraft` contract|
| 04 | `04-features.md`           | Feature-by-feature behavior                                  |
| 05 | `05-ai-ingestion.md`       | DOCX/PDF → structured article pipeline                       |
| 06 | `06-api.md`                | HTTP contracts (web, internal, ingestion)                    |
| 07 | `07-security.md`           | AuthN/Z, data handling, compliance                           |
| 08 | `08-roadmap.md`            | Milestones, risks                                            |
| 09 | `09-version-history.md`    | Version list, compare, restore                               |
| 10 | `10-page-tree.md`          | Article parent/order, sidebar tree, move                     |
| 11 | `11-article-notes.md`      | Field notes on an article                                    |
| 12 | `12-per-page-permissions.md` | Narrow who may open a page; inherit down the tree          |
| 13 | `13-a11y-keyboard.md`      | Playwright + axe commands; keyboard-only walkthrough       |
| 14 | `14-lighthouse.md`         | Lighthouse thresholds + commands for the article view      |
| 15 | `15-visual-regression.md`  | Playwright screenshot baselines for the article view      |
| 16 | `16-load.md`               | Article 1k rps + 100 concurrent ingest load gates          |
| 17 | `17-security-asvs-l1.md`   | OWASP ASVS Level 1 pilot checklist + evidence              |
| 18 | `18-pilot.md`             | Pilot kickoff decisions, import/office-hours checklist     |

Supporting:

- `../mocks/` — PNG mocks and Figma exports. North-star visual target.
- `../pilot/` — Go/No-Go report for M8 (`go-no-go.md`).
- `adr/` — Architecture Decision Records. [0001](adr/0001-server-managed-sessions.md) replaces Auth.js and Redis sessions.

## How to change a spec

1. Open a PR touching **only** `Docs/`.
2. Reference the mock and prior spec sections.
3. If this is a stack change, write an ADR under `adr/`.
4. Update `../../progress.md` and `../../claude.md` if the change affects agent workflows.

## Priority order when specs disagree

1. `02-design-system.md` for visual decisions.
2. The reference mock for anything the design system doesn't cover.
3. The newer spec wins — update the older one in the same PR.
