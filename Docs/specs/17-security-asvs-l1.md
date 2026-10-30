# 17 — OWASP ASVS Level 1 (pilot gate)

> Gate for suggested-order item 32. Maps [OWASP ASVS](https://github.com/OWASP/ASVS) Level 1 controls that apply to TechBase onto evidence in this repo. Full ASVS text remains upstream; this file is the **pilot checklist**, not a fork of ASVS.

Companion: [`07-security.md`](07-security.md), ADR 0001 / 0002.

## How to run the automated slice

```powershell
cd frontend
pnpm test
pnpm exec tsx --test "lib/security/**/*.test.ts" "lib/auth/policy.test.ts"

cd ..\backend
uv run pytest
uvx pip-audit

cd ..\frontend
pnpm audit --prod --audit-level=high
```

CI runs unit tests plus `pnpm audit --prod --audit-level=high` / `uvx pip-audit` on PRs (`security-audit` job). The `shadcn` CLI is **not** a runtime dependency — add primitives with `pnpm dlx shadcn@latest add …` (claude.md §0.3). Prisma’s `deepmerge-ts` is forced to `8.0.2` via `overrides` in `frontend/pnpm-workspace.yaml` (pnpm 12; GHSA-ggr8-5vv4-36mx).

## Status legend

| Mark | Meaning |
|------|---------|
| ✅ | Met for pilot with evidence in-repo |
| 🟡 | Partial — acceptable for pilot with noted residual risk |
| ⬜ | Deferred past pilot (called out in 07-security) |
| N/A | Not applicable to this architecture |

---

## Checklist (TechBase-scoped L1)

### Authentication & sessions

| Control (summary) | Status | Evidence |
|-------------------|--------|----------|
| Passwords hashed with modern KDF | ✅ | Argon2id in `auth/web` / `frontend/lib/auth/password.ts` |
| Password complexity + zxcvbn | ✅ | `auth/web` password-policy + HIBP range API |
| Brute-force / rate limit on login | ✅ | 5 / 10 min per IP + email (`LOGIN_LIMIT`) |
| Session opaque, server-side, revocable | ✅ | Postgres `auth.session`; ADR 0001 |
| Session cookie `Secure` + `HttpOnly` + `__Host-` | ✅ | `__Host-tb_session`, SameSite=Lax |
| Logout / password change invalidates sessions | ✅ | Session delete + `sessionGen` bump |
| MFA / passkeys optional, separate from password | ✅ | ADR 0002; Security page |
| No credentials in repo | ✅ | `.gitignore`; `frontend/.env.example` + `backend/.env.example` |

### Access control

| Control | Status | Evidence |
|---------|--------|----------|
| Server-side authorization on every mutation | ✅ | `can()` / FastAPI `require_capability`; policy unit tests |
| Role matrix enforced (not UI-only) | ✅ | `07-security.md` §3; `policy.test.ts` |
| Public article is explicit allow-list | ✅ | `visibility=public` + proxy rewrite to `/p/[slug]` |
| Per-page narrowing never elevates role | ✅ | `12-per-page-permissions.md` |

### CSRF / request authenticity

| Control | Status | Evidence |
|---------|--------|----------|
| Server Actions Origin/Host check | ✅ | Next.js built-in (keep Next patched) |
| Cookie session + mutating `/api/*` same-origin | ✅ | `forbidBadOrigin` on upload + view count POSTs |
| Double-submit `tb_csrf` cookie (07-security wording) | 🟡 | SameSite + Origin cover L1; token cookie still a follow-up for defense-in-depth |

### Input / files / API

| Control | Status | Evidence |
|---------|--------|----------|
| Upload type allowlist + size cap | ✅ | `.docx`/`.pdf`, 25 MB; presign + ingest |
| Parse off the web tier | ✅ | Python service only |
| FastAPI assertion auth (no browser cookie) | ✅ | 60s HMAC; `test_assertion.py` |
| Structured errors, no stack traces to clients | 🟡 | FastAPI/Next defaults; tighten prod exception pages before GA |

### Crypto, transport, headers

| Control | Status | Evidence |
|---------|--------|----------|
| TLS + HSTS in production responses | ✅ | `SECURITY_HEADERS` + `proxy.ts` |
| CSP with nonce (no `unsafe-inline` scripts) | ✅ | `buildContentSecurityPolicy`; theme/`$RT` hashes |
| `X-Content-Type-Options`, `frame-ancestors`/`X-Frame-Options` | ✅ | `headers.test.ts` |
| MFA secrets encrypted at rest | ✅ | `AUTH_MFA_KEY` |

### Logging & vuln management

| Control | Status | Evidence |
|---------|--------|----------|
| Auth audit events | ✅ | `auth.audit_event` |
| Dependency audit in CI | ✅ | `security-audit` job: `pnpm audit --audit-level=high`, `uvx pip-audit` |
| Container image scan (trivy) | ⬜ | When images ship in CI |
| Prompt / LLM bodies not logged | 🟡 | Structlog; keep reviewing extractor logs |

### Deferred (documented, not pilot-blocking)

| Item | Notes |
|------|--------|
| ClamAV on uploads | Optional in 07-security §7 |
| GDPR export/delete admin API | 07-security §11 — before regulated tenants |
| SOC 2 Type I | Post-GA |
| OIDC / SAML | Phase B |
| Redis/Postgres TLS in local docker | Required in prod config, not local |

---

## Pass criteria for item 32

1. This checklist has no unmarked L1 rows that are in scope (only ⬜ deferred or N/A remain open).
2. `pnpm test` (frontend security/policy tests) and `uv run pytest` pass.
3. CI `security-audit` is green on the PR (or documented waiver for a specific CVE with owner + date).

Residual 🟡 items stay on the hardening backlog; they do not block the pilot checkmark once acknowledged above.
