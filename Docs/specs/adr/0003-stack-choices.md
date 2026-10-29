# ADR 0003 — Locked application stack

- **Status:** Accepted
- **Date:** 2026-10-29
- **Branch:** `docs/stack-adr`

## Context

TechBase has been building against an opinionated stack described in `claude.md` and the numbered specs. Several choices drifted in the scaffold (Next.js 16.4.x instead of the original “15” line, Prisma 6 instead of chasing Prisma 8 RC, `node:test` instead of Vitest). Auth already has dedicated ADRs ([0001](0001-server-managed-sessions.md), [0002](0002-webauthn-passkeys.md)).

This ADR records the **application stack** so a later swap (Chakra, Drizzle, LangChain-the-framework, a second web UI kit, etc.) requires a new ADR rather than a quiet PR.

## Decision

### Web app (`frontend/`)

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js ≥ 16.4.3** App Router, React 19, Server Components / Server Actions | Server-first rendering, streaming, BFF for auth and ingestion. Floor is **16.4.3** (current app pin); newer 16.x patches are fine. Do not install below 16.4.3 or jump to 17 without a new ADR. |
| Language | TypeScript, `strict` | Shared types with generated OpenAPI clients. |
| Styling | **Tailwind CSS v4** + CSS variables | Matches `02-design-system.md`; tokens live in `globals.css`. |
| Components | **shadcn/ui** (Radix / Base UI), restyled | Primitives installed via CLI only; composites are hand-built. Stock shadcn is not the finish line. |
| Icons / fonts | Lucide; Geist Sans + Geist Mono | Dense IT UI; monospace for commands. |
| Client cache | TanStack Query where client fetch is needed; RSC by default | Avoid a second global client store. |
| Forms | React Hook Form + Zod when forms grow; server actions for admin posts today | Validation stays isomorphic. |
| Article editor | **TipTap** (ProseMirror) with custom nodes | Prerequisites, steps, callouts, and code match the read view. |
| ORM | **Prisma 6** → Postgres | Versioned articles and the `auth` schema. Pin stays on v6 while Prisma 8’s migrate CLI is unacceptable for this repo. |
| Search (v1) | Postgres `tsvector` | Enough for internal corpus; Meilisearch remains an upgrade path, not a second source of truth yet. |
| Package manager | **pnpm** | Lockfile and CI already assume it. |

### Ingestion service (`backend/`)

| Concern | Choice | Why |
| --- | --- | --- |
| Runtime | **Python 3.12** | Document-parsing ecosystem. |
| API | **FastAPI** + Pydantic Settings | OpenAPI is generated from the app; TS types come from that schema ([`frontend/lib/api/generated/`](../../../frontend/lib/api/README.md)). |
| Package manager | **uv** | Lockfile + `uv run` in CI. |
| Parsing | `python-docx`, `pdfplumber` (Unstructured later) | Word and text PDF in v1; OCR later. |
| LLM | Pluggable OpenAI-compatible client (`AI_*` env; OpenRouter in local) behind a small extractor interface | Host can change provider without rewriting the pipeline. No LangChain-as-framework. |
| Object storage | S3-compatible (SeaweedFS / MinIO in dev) | Uploads before draft persist. |

### Cross-cutting

| Concern | Choice | Why |
| --- | --- | --- |
| Auth | Opaque Postgres sessions, Next.js BFF, 60s HMAC assertion to FastAPI | [ADR 0001](0001-server-managed-sessions.md). Passkeys: [ADR 0002](0002-webauthn-passkeys.md). OIDC later. |
| Cache / queue | Redis (Upstash-compatible); BullMQ when the job queue moves off in-process | Sessions are **not** in Redis (ADR 0001). |
| Observability | Structured JSON logs now; OpenTelemetry → Grafana/Tempo when wired | Failures must be greppable in pilot. |
| Testing | Frontend: `tsx --test` (`node:test`) + ESLint + `tsc`; Backend: pytest + ruff | Vitest/Playwright remain allowed upgrades; do not add a second unit runner without need. |
| Repo layout | `frontend/`, `backend/`, `auth/web`, `auth/py` — no `packages/` monorepo yet | Shared OpenAPI output lives under `frontend/lib/api/generated/`. |
| CI | GitHub Actions on PR/`main` | Lint, typecheck, unit tests, OpenAPI drift. |

### Explicitly out of scope (require a new ADR)

- Replacing Next.js, FastAPI, Prisma, Tailwind, or shadcn with another primary stack.
- Introducing Chakra, MUI, Mantine, or a second component system.
- Swapping Prisma for Drizzle/SQLAlchemy as the app ORM.
- Adopting LangChain (or similar) as the orchestration framework.
- Moving sessions back to JWT-in-browser or Auth.js defaults.
- A `packages/` TypeScript monorepo (until shared code forces it).

## Consequences

- Specs and `claude.md` that still say “Next.js 15” or `packages/types` should be read as **Next.js ≥ 16.4.3** and `frontend/lib/api/generated/` unless a future ADR changes them.
- `frontend/package.json` keeps `next` (and matching `eslint-config-next`) at **`^16.4.3`** so installs cannot resolve below the floor; the lockfile records the exact patch in use.
- New dependencies that duplicate a locked layer need an ADR first.
- Pilot and hardening work (a11y, Lighthouse, load) stay on this stack; they do not justify a framework swap mid-flight.

## Related

- [ADR 0001 — Server-managed sessions](0001-server-managed-sessions.md)
- [ADR 0002 — WebAuthn passkeys](0002-webauthn-passkeys.md)
- `claude.md` §3 Tech stack
- `Docs/specs/01-architecture.md`, `08-roadmap.md`
