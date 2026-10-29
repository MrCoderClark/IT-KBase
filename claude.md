# TechBase — AI Agent Guide (claude.md)

> This file is the entry point for any AI coding agent (Claude, Devin, Copilot, Cursor, Codex, etc.) working in this repository. Read it before touching code. If you discover anything that contradicts or extends this file, update it in the same change.

---

## 0. Operating rules (read first, every session)

These override anything below if they conflict.

### 0.1 The user runs commands (on Windows PowerShell)

**Do not execute shell commands unless the user explicitly asks you to.** This includes `pnpm`, `uv`, `git`, `docker`, migrations, installs, dev servers, tests — everything.

The user's shell is **Windows PowerShell**. Write every command block in PowerShell syntax, not bash:

- Separate steps with newlines (one command per line) or `;`. **Do not use `&&` or `||`** — those are PowerShell 7-only and silently fail or misparse in older versions.
- Change directory with `Set-Location frontend` or the shorter `cd frontend`. Don't assume POSIX subshells like `(cd frontend && …)`.
- Redirect to null with `2>$null`, not `2>/dev/null`.
- Paths use `\` or forward slashes (both work); don't use `~` for home — use `$HOME` or `$env:USERPROFILE`.
- Env vars in commands: `$env:FOO = "bar"` (not `FOO=bar prefix`).
- When a command must only run on success of the previous one, split into two blocks or write it as `if ($LASTEXITCODE -eq 0) { … }`.
- Fenced blocks should be tagged ```powershell for clarity.

Instead of running commands, you:
- Write the exact command(s) in a ```powershell block for the user to copy/run.
- Say briefly what each command does and in which directory.
- Wait for the user to report the result before continuing.

Exceptions (allowed without asking):
- Read-only inspection the user can't see otherwise (`ls`, `cat`, `grep`, file reads) — use the dedicated tools, not shell.
- Anything the user explicitly told you to run in the current turn (e.g. "go ahead and run the tests").

If a task clearly requires a sequence of commands, present the whole sequence in one block with a short note on expected output, then stop.

### 0.2 Branch per feature

We use git with a **feature-branch-per-change** workflow. For every new feature, bug fix, or non-trivial doc change:

1. Before writing code or edits, propose a branch name: `feat/<short-kebab>`, `fix/<short-kebab>`, `chore/<short-kebab>`, or `docs/<short-kebab>`.
2. Ask the user to create and check it out (per rule 0.1), e.g.:
   ```bash
   git switch -c feat/article-detail-view
   ```
3. Do the work on that branch.
4. When the feature is done, propose the commit(s) and ask the user to run them. Commit style follows the Devin git rules (concise, "why" over "what", co-author trailer).
5. Do not merge, rebase, or push without explicit instruction.

Never commit directly to `main`. If you notice we're on `main` when a change is about to start, stop and ask the user to branch first.

**Don't spin a dedicated branch for one-line / trivial fixes.** If a tiny issue (a typo, a warning filter, a renamed import, an off-by-one in a config value) surfaces outside of a feature branch, roll it into the next feature branch's commit rather than making a `fix/<thing>` branch for a single edit. Dedicated `fix/` branches are for real bugs with scope — not housekeeping. When in doubt about scope, ask.

### 0.3 Never hand-write shadcn primitives

shadcn/ui components (`button`, `input`, `dialog`, `dropdown-menu`, `tooltip`, `command`, `sheet`, …) are **installed by the user via the shadcn CLI**, not hand-authored.

When a feature needs a new primitive:

1. Say which component is needed and why.
2. Give the user the exact install command, e.g.:
   ```bash
   # from frontend/
   pnpm dlx shadcn@latest add button dialog
   ```
3. Wait for the user to run it. The CLI generates files under `frontend/components/ui/` with the current project config.
4. Only then — restyle those generated files to match `Docs/specs/02-design-system.md` (tokens, radii, padding, focus ring). Restyling is required; stock shadcn is a starting point, not the finish line.

Do **not**:
- Create files in `frontend/components/ui/` from scratch for primitives that shadcn provides.
- Copy-paste shadcn source off the web into the repo.
- Install the shadcn CLI itself or run `shadcn init` (user owns that too).

Custom composite components built *on top of* the primitives (e.g. `SectionHeader`, `StepBadge`, `Callout`, `CodeBlock`) are hand-authored and live outside `components/ui/` — those are fair game.

---

## 1. What this product is

**TechBase** is an enterprise-grade **IT Knowledge Base** for internal IT teams (helpdesk, sysadmins, SRE, security). It turns messy source material — Word documents, PDFs, pasted runbooks — into **structured, searchable, versioned knowledge articles** with the help of an AI ingestion pipeline.

The reference UX is captured in `Docs/mocks/TechBase Windows Knowledge Article.png`. Treat that mock as the **north-star visual target** for the article detail view.

Primary user: **IT Administrator / Engineer** (e.g. "Joe Clark, IT Administrator" in the mock).

Primary jobs-to-be-done:

1. **Ingest** — drop in a Word/PDF, get a clean, structured article (Overview, Prerequisites, Step-by-Step, Verification, Troubleshooting, Related).
2. **Find** — search, filter by category/tag, browse recently updated, use `Ctrl+K` command palette.
3. **Trust** — see versioning, author, last-updated, and related articles. Vote helpful / not helpful.
4. **Reuse** — download as PDF, copy link, print, share internally.

---

## 2. Non-negotiables

These are the rules that distinguish this app from a vibe-coded prototype. Enforce them in reviews and in your own PRs.

1. **It must not look AI-generic.** No stock "SaaS gradient hero", no default shadcn-untouched components, no generic Lucide-icon dashboards. Follow `Docs/specs/02-design-system.md` strictly. If a screen looks like 100 other Next.js demos, redesign it.
2. **Dark sidebar + light canvas** is the signature layout (see mock). Keep it.
3. **Information density matters.** IT pros scan. Prefer compact tables, keyboard shortcuts, inline metadata chips, and multi-column layouts over oversized marketing cards.
4. **Typography is a feature.** Use a variable sans for UI and a monospace for commands/code. See design system spec for exact stack.
5. **Every destructive action is reversible or confirmed.** Articles are versioned; deletes are soft; publish/unpublish is explicit.
6. **Accessibility is required**, not optional. WCAG 2.2 AA minimum. All interactive elements keyboard-reachable. Color is never the only signal.
7. **No lorem ipsum ships.** Seed data must be realistic IT content (Windows, Linux, networking, M365, Active Directory, ServiceNow integrations, etc.).
8. **Python owns heavy processing.** Next.js never parses PDFs or runs LLM extraction directly — it enqueues jobs and polls/streams results from the Python service.

---

## 3. Tech stack (locked)

| Layer                   | Choice                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| Web framework           | **Next.js ≥ 16.4.3** (App Router, Server Components, Server Actions)   |
| Language (web)          | TypeScript (strict)                                                    |
| Styling                 | **Tailwind CSS v4** with CSS variables for theme tokens                |
| Component primitives    | **shadcn/ui** (Radix-based), customized — not stock                    |
| Icons                   | Lucide + a small custom set for brand/section marks                    |
| Fonts                   | Geist Sans (UI), Geist Mono (code), Inter fallback                     |
| State / data fetching   | React Server Components + TanStack Query for client-side cache         |
| Forms                   | React Hook Form + Zod                                                  |
| Rich text / article     | TipTap (ProseMirror) with custom nodes for Prerequisites, Steps, Code  |
| Cache & queue           | **Redis** (Upstash-compatible) — sessions, article cache, BullMQ queue |
| Primary datastore       | Postgres (via Prisma)                                                  |
| Full-text search        | Postgres `tsvector` initially; Meilisearch upgrade path                |
| Backend processing      | **Python 3.12** FastAPI service                                        |
| Document parsing        | `python-docx`, `pypdf` / `pdfplumber`, `unstructured` for fallback     |
| LLM orchestration       | Pluggable: OpenAI / Anthropic / local via a `KBExtractor` interface    |
| Object storage          | S3-compatible (MinIO in dev)                                           |
| Auth                    | Opaque Postgres sessions, Next.js BFF, 60s HMAC assertion to FastAPI. [ADR 0001](Docs/specs/adr/0001-server-managed-sessions.md). OIDC is a later phase. |
| Observability           | OpenTelemetry → Grafana/Tempo; structured JSON logs                    |
| Testing                 | `tsx --test` / ESLint / `tsc` (web), pytest + ruff (Python); Playwright later |
| Package manager (web)   | pnpm                                                                   |
| Package manager (py)    | uv                                                                     |

**Do not add alternatives** (e.g. Chakra, MUI, Mantine, LangChain-the-framework, Prisma→Drizzle swap) without an ADR in `Docs/specs/adr/`. Locked choices are recorded in [ADR 0003](Docs/specs/adr/0003-stack-choices.md).

---

## 4. Repository layout (actual)

```
it-kbase/
├─ frontend/                   # Next.js 15 app (pnpm)
│  ├─ app/                     # App Router routes
│  ├─ components/              # UI components (ui/, kb/, layout/)   [to be added]
│  ├─ lib/                     # Clients, utils, server actions      [to be added]
│  ├─ styles/                  # globals.css, tokens.css             [to be added]
│  ├─ public/
│  ├─ package.json
│  ├─ pnpm-lock.yaml
│  ├─ pnpm-workspace.yaml
│  ├─ tsconfig.json
│  ├─ next.config.ts
│  ├─ eslint.config.mjs
│  └─ AGENTS.md                # Next.js-specific agent notes (do not duplicate claude.md here)
├─ backend/                    # Python 3.12 FastAPI ingestion service (uv)
│  ├─ src/                     # package source
│  │  └─ (ingestion package)   # api/, pipeline/, extractors/, schemas/  [to be added]
│  ├─ tests/                                                              [to be added]
│  ├─ pyproject.toml
│  └─ README.md
├─ auth/                       # Reusable auth module (no TechBase imports)
│  ├─ web/                     # Next.js session, cookies, CSRF, assertion minting
│  └─ py/                      # FastAPI assertion verification
├─ Docs/
│  ├─ mocks/                   # PNGs, Figma exports
│  └─ specs/                   # Numbered specs (source of truth)
├─ infra/                      # docker-compose, Dockerfiles           [to be added]
├─ claude.md                   # ← you are here
├─ progress.md
└─ README.md
```

Notes:
- Earlier spec drafts reference `apps/web` and `services/ingestion`. The real paths are **`frontend/`** and **`backend/`**. When updating a spec during a change, migrate the paths it mentions.
- Shared types (generated from the Python OpenAPI) land in `frontend/lib/api/generated/` — we are **not** introducing a `packages/` monorepo yet. If we ever extract shared packages, open an ADR.
- `frontend/AGENTS.md` can hold frontend-only notes (e.g. "always use Server Components by default"); it must not restate rules from `claude.md`.

---

## 5. How to work in this repo

### Before you start a task

1. Read the relevant spec in `Docs/specs/`.
2. Check `progress.md` to see what's done, in-flight, and blocked.
3. Confirm the mock in `Docs/mocks/` — if a visual decision isn't covered, ask or propose and record it in the design-system spec.

### While coding

- Use **Server Components by default**. Only drop to `"use client"` for interactivity.
- Co-locate route-specific components under `app/(section)/_components/`.
- Never import `tailwindcss` class strings via dynamic concatenation that defeats JIT; always keep classes statically analyzable.
- Prefer **composition over props explosion**. If a component has >8 props, split it.
- Every new shadcn primitive must be **restyled** to match the design system (padding scale, radii, border treatment, focus ring). Stock shadcn is a starting point, not the finish line.
- Python endpoints must return **Pydantic-typed** responses; the TS client is generated from the OpenAPI schema.

### Before you ask the user to open a PR

Hand them this command block (per rule 0.1, you don't run it). PowerShell syntax — one command per line:

```powershell
# from frontend/
cd frontend
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
cd ..

# from backend/
cd backend
uv run ruff check .
uv run pytest
cd ..
```

Also:
- Update `progress.md` (move items, add new ones, note blockers).
- Update specs if behavior changed.
- Confirm the branch name matches rule 0.2.

### Commits

Follow the git rules in the Devin system prompt (concise, "why" over "what", co-author trailer when generated by Devin). One logical change per commit. No "fix typo in previous commit" chains — amend if local. Per rule 0.1, propose commits for the user to run; don't commit yourself.

---

## 6. Visual identity cheat sheet

Full details in `Docs/specs/02-design-system.md`. Quick reference:

- **Brand name**: TechBase. Tagline: "IT Knowledge Hub".
- **Logo**: isometric cobalt cube/polyhedron with inner highlight. Never flat; always has the subtle inner-face lighting from the mock.
- **Primary accent**: cobalt blue `#1E6BFF` on dark; same hue tuned for AA on light.
- **Sidebar**: deep navy-black `#0B1220` → `#0F172A` vertical gradient, with a subtle inner highlight at the top.
- **Canvas**: `#F6F8FB` (light) / `#0A0F1C` (dark).
- **Chips**: pill-shaped, 11px uppercase or 12px sentence case; category chips are tinted, tag chips are outlined.
- **Section headers in articles**: icon in a soft tinted square, 18–20px bold title. See mock.
- **Numbered steps**: filled circular badge, cobalt, 28px, white digit.
- **Callouts**: left-tinted panels (Info, Important, Warning, Success) with a leading icon and a subtle 1px tinted border.
- **Code blocks**: near-black `#0B1220`, monospace, copy affordance top-right, soft inner glow on focus.
- **Radii**: `--radius-sm: 8px`, `--radius-md: 12px`, `--radius-lg: 16px`, `--radius-xl: 20px` (cards).
- **Shadows**: use layered low-opacity shadows (`0 1px 2px rgba(15,23,42,.06), 0 8px 24px rgba(15,23,42,.06)`), never a single large blur.

---

## 7. Content model at a glance

An **Article** has:

- `id`, `slug`, `title`, `summary`, `heroImage?`
- `category` (single), `tags` (many)
- `sections[]` — ordered, typed: `overview | prerequisites | steps | verification | troubleshooting | related | custom`
- `status`: `draft | in_review | published | archived`
- `version` (semantic-ish: `1.0`, `1.1`, `2.0`)
- `authorId`, `createdAt`, `updatedAt`, `publishedAt`
- `readingTimeMinutes`
- `metrics`: `{ views, helpful, notHelpful }`
- `source?`: `{ type: 'docx' | 'pdf' | 'manual' | 'url', originalFileId, extractorRunId }`

Full schema in `Docs/specs/03-data-model.md`.

---

## 8. Ingestion pipeline at a glance

```
Upload (Next.js) ─▶ S3 ─▶ POST /ingest (Python)
                                 │
                                 ▼
          ┌─────────────────────────────────────────┐
          │ parse → normalize → segment → extract   │
          │ (python-docx / pdfplumber / unstructured)│
          │                                         │
          │ structure(LLM) → validate(Zod/Pydantic) │
          │ → persist draft → emit SSE events       │
          └─────────────────────────────────────────┘
                                 │
                                 ▼
                     Redis stream (job progress)
                                 │
                                 ▼
                Next.js subscribes, updates UI live
```

Full details in `Docs/specs/05-ai-ingestion.md`. Key rule: **the LLM never writes directly to the DB**. Its output passes through a Pydantic validator; invalid output triggers one repair pass, then a hard fail with a human-fixable draft.

---

## 9. Environments

| Env     | Web                      | Python                   | Redis            | DB                 |
| ------- | ------------------------ | ------------------------ | ---------------- | ------------------ |
| local   | `pnpm dev` (`:3000`)     | `uv run fastapi` (`:8080`) | docker compose | docker compose     |
| preview | Vercel preview per PR    | Fly.io / Render per PR   | Upstash          | Neon branch        |
| prod    | Vercel                   | Fly.io / ECS             | Upstash          | Neon / RDS         |

Secrets never land in the repo. See `Docs/specs/07-security.md`.

---

## 10. When in doubt

- **Design question** → check `02-design-system.md`, then the mock, then ask.
- **Behavior question** → check `04-features.md`.
- **Data question** → check `03-data-model.md`.
- **Pipeline question** → check `05-ai-ingestion.md`.
- **API contract** → check `06-api.md` and the generated OpenAPI client.
- **"Can I add a dependency?"** → open an ADR under `Docs/specs/adr/` first.

Keep this file short, opinionated, and up-to-date. If you had to re-derive something while working, write it down here so the next agent doesn't.
