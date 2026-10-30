# 18 — Pilot (M8)

> Gate for suggested-order item 33. Outcome from `08-roadmap.md`: internal IT adopts TechBase, real docs are imported, and a **Go / No-Go** note decides GA.

This is an **ops + product** gate, not a code feature. Fill the decisions, run the checklist, then write the report in [`../pilot/go-no-go.md`](../pilot/go-no-go.md).

## 1. Decide before kickoff

Record answers here (and in `progress.md` decisions log when settled). Until filled, treat the pilot as **not started**.

| # | Question | Decision | Owner | Date |
|---|----------|----------|-------|------|
| D1 | Single tenant for the pilot, or a tenant id from day one? | **Single tenant** for the pilot (no tenant id in schema yet). | Joe | 2026-10-30 |
| D2 | Which LLM is primary in production? (interface stays pluggable) | **Same as current local stack** — OpenAI-compatible via `AI_*` (OpenRouter host + model already in use). Interface stays pluggable; no provider swap for GA. | Joe | 2026-10-30 |
| D3 | Is Entra ID (or other SSO) required for the pilot, or password + optional MFA/passkeys enough? | **Current auth only** — password + optional MFA/passkeys (ADR 0001 / 0002). Entra/OIDC stays post-pilot. | Joe | 2026-10-30 |

Related backlog (do **not** build during pilot unless a Go decision depends on it): semantic search, OCR, multi-tenant SaaS, co-editing, URL ingest, ticket import — see `08-roadmap.md` post-GA list and `suggested-order.md` “After the pilot”.

## 2. Environment checklist

**Pilot decision (2026-10-30):** run on the **current local stack and existing `.env` files as-is** (Postgres, Redis/SeaweedFS, assertion keys, `AI_*`). No separate preview host required to start. Tighten TLS / dedicated host only if the go/no-go calls for GA.

| Step | Done |
|------|:----:|
| Current local host (`:3000` / `:8080`) accepted for pilot | ✅ |
| Postgres + Redis + S3-compatible storage reachable (existing) | ✅ |
| `frontend/.env` / `backend/.env` kept as-is (still gitignored) | ✅ |
| Seed pilot users (admin Joe, authors, reviewer Marcus, **reader Sam Lee**) | ✅ (re-run `pnpm exec prisma db seed`) |
| `AUTH_ASSERTION_KEYS` matches `TB_ASSERTION_KEYS` (already aligned locally) | ✅ |
| LLM key set **or** explicitly empty with “structure off” accepted (current `AI_*`) | ✅ |
| Security headers: existing `proxy.ts` + unit smoke (`applySecurityHeaders`) | ✅ (`pnpm exec tsx --test lib/security/headers.test.ts`) |
| ASVS L1 checklist still green (`17-security-asvs-l1.md`) | ✅ |
| Backup / restore note for the pilot DB | ⬜ waived for local-as-is pilot |

## 3. Content (IT admins own the sources)

**Pilot model:** IT admins produce articles themselves — **Create** (manual TipTap) and/or **Import** (Word/PDF upload). There is no separate “collect SharePoint dump for the facilitator” step; admins bring or write what they need on the job.

Goal: at least **10** published procedures that are **not** seed data.

| Step | Done |
|------|:----:|
| Brief admins: Create vs Import, review/publish roles | ☐ |
| Admins add real runbooks (manual and/or upload) | ☐ |
| Reviewer signs off before publish; scrub secrets | ☐ |
| Log each piece in go/no-go Evidence (source = manual / upload + filename) | ☐ |
| Mark at least one article `visibility: public` if anonymous read is needed | ☐ |
| For uploads: note rough time upload → usable draft (~60s target for ~10 pages) | ☐ |

Capture upload failures (parse errors, bad segmentation, LLM stalls) in the evidence table.

## 4. Sit with the team (office hours)

| Activity | Done |
|----------|:----:|
| Kickoff (15 min): purpose, roles, what “good” looks like | ☐ |
| Live search + `Ctrl+K` with an L1 (Sam persona) | ☐ |
| Live author/edit with an admin (Joe persona) | ☐ |
| Live review/publish with a KB owner (Priya persona) | ☐ |
| Collect pain points in a shared notes doc (link below) | ☐ |
| Schedule follow-up within 1 week of kickoff | ☐ |

Pilot notes link: _TBD_

## 5. Success signals (suggest, then adjust)

Use these as defaults; change in the go/no-go report if the team agrees otherwise.

| Signal | Suggest target |
|--------|----------------|
| Articles published (manual + upload, not seed) | ≥ 10 |
| Distinct weekly active readers (pilot week) | ≥ 5 |
| “Would use this over SharePoint for runbooks” (thumbs / verbal) | Majority yes |
| Sev-blocking bugs open at decision time | 0 |
| Time-to-find a known procedure vs old location | Subjectively faster for ≥ 3 spot checks |

## 6. Go / No-Go

Write the decision in [`../pilot/go-no-go.md`](../pilot/go-no-go.md).

| Outcome | Meaning |
|---------|---------|
| **Go** | Proceed toward GA; list must-fix follow-ups with owners |
| **Go with conditions** | GA blocked on named items (e.g. SSO); pilot may continue |
| **No-Go** | Stop or pause; state why and what would change the call |

Item 33 is ✅ only when that report has a dated decision and the import + office-hours rows above are checked (or explicitly waived with reason).
