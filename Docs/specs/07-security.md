# 07 — Security & Compliance

## 1. Threat model (summary)

| Threat                                              | Likelihood | Impact | Primary mitigation                      |
|-----------------------------------------------------|------------|--------|-----------------------------------------|
| Stolen session cookie                               | M          | H      | `__Host-` cookie, SameSite=Lax, short TTL, device/IP binding on sensitive routes |
| Malicious upload (DOCX macros, PDF JS)              | M          | M      | Content-type sniff + extension allowlist, no server-side rendering of macros, parse in sandbox |
| Prompt injection in uploaded documents              | H          | M      | Fixed system prompt, output schema validation, no tool calls from the LLM |
| LLM data exfiltration via logs                      | M          | M      | Redact prompt bodies from logs; artifact bundle is behind access control |
| CSRF on mutating endpoints                          | M          | M      | Double-submit CSRF token + SameSite cookie |
| Privilege escalation (reader → admin)               | L          | H      | Server-side role checks on every mutation, no client-side gating as source of truth |
| Service-token leak                                  | L          | H      | Short-TTL tokens, scoped, rotated every 30d, never logged |
| Supply-chain (dep compromise)                       | M          | H      | Pin ranges, minimum age ≥ 7 days, `npm audit` + `pip-audit` in CI, Snyk on main |

## 2. Authentication

Accepted in [ADR 0001](adr/0001-server-managed-sessions.md). Summary:

- **Phase A:** email and password, checked by the Next.js server. The browser holds an opaque session cookie only.
- **MFA (optional):** a confirmed authenticator adds a second step before the session cookie is set. Enrollment shows a QR code; the setup key is available when a camera cannot scan it. The pending login lasts 5 minutes. Recovery codes are single-use and stored as SHA-256 hashes. The TOTP secret is encrypted with `AUTH_MFA_KEY`. Turning MFA on or off, and replacing recovery codes, revokes every other session.
- **Later:** OIDC (Entra ID, Google Workspace), SAML 2.0, and passkeys. Those issue the same cookie.
- Password rules (credentials): min 12 chars, must include 3 of {upper, lower, digit, symbol}, zxcvbn score ≥ 3. Breach check against HIBP range API. Hash: Argon2id, memory 19 MiB, iterations 2, parallelism 1.
- Sessions live in Postgres `auth.session`. Redis is not the session store.
  - Cookie `__Host-tb_session`: `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`.
  - TTL 7 days absolute, 24h idle.
  - New session id on login. Logout deletes that session. Password change, password reset, and role change delete every session for that identity.
- FastAPI never receives the session cookie. Next.js sends a 60-second HMAC assertion (`Authorization: Bearer v1...`) after it has validated the session. FastAPI verifies the signature, audience, and expiry, then applies its own permission check.
- Login rate limit: 5 attempts per 10 minutes, per IP and per email, counted in Postgres.

## 3. Authorization

Roles: `reader | author | reviewer | admin`.

| Capability                                            | reader | author | reviewer | admin |
|-------------------------------------------------------|:------:|:------:|:--------:|:-----:|
| View published articles                               | ✅     | ✅     | ✅       | ✅    |
| Give feedback                                         | ✅     | ✅     | ✅       | ✅    |
| Create / edit own drafts                              |        | ✅     | ✅       | ✅    |
| Submit for review                                     |        | ✅     | ✅       | ✅    |
| Edit any draft                                        |        |        | ✅       | ✅    |
| Publish / unpublish                                   |        |        | ✅       | ✅    |
| Rollback version                                      |        |        |          | ✅    |
| Archive / unarchive                                   |        |        |          | ✅    |
| Mark a published article public                       |        |        | ✅       | ✅    |
| Manage users / integrations / settings                |        |        |          | ✅    |

An anonymous caller may read a single article when `status` is `published` and `visibility` is `public`. No other capability is available without a session. Draft, in-review, and archived articles stay private.

Enforcement:
- **Every** server action and API route checks `can(principal, capability, resource)` in `frontend/lib/auth/policy.ts`. The reusable package does not know about articles. FastAPI repeats the check for its own routes.
- Policy is table-driven and unit-tested.
- UI hiding is a usability layer, not a security layer.

## 4. Data classification

| Class            | Examples                                       | Handling                                                   |
|------------------|------------------------------------------------|------------------------------------------------------------|
| Public           | One published article with `visibility=public` | Read view only, no app chrome, no links to other articles. |
| Internal         | Published KB articles                          | Default. Authenticated access only.                        |
| Sensitive        | Drafts, raw uploads, artifact bundles          | Role-gated; signed URLs; shorter retention                 |
| Secret           | Service tokens, OIDC secrets, LLM API keys     | Never in repo; env/secret manager; never logged            |

## 5. Transport & storage

- **TLS 1.2+ only**, HSTS 1 year with `includeSubDomains`.
- Postgres connections TLS-required; Redis TLS-required in prod.
- S3 buckets private, blocked public access, SSE enabled.
- At rest: database and S3 encryption via provider KMS. Field-level encryption for integration secrets (API keys stored as `pgcrypto` encrypted values with a KMS-wrapped key).

## 6. Cookies & headers

Required response headers on all app routes:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; img-src 'self' https: data: blob:;
                         script-src 'self' 'strict-dynamic' <nonces>;
                         style-src 'self' 'unsafe-inline';
                         connect-src 'self' https://ingestion.*.techbase; 
                         frame-ancestors 'none'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

Cookie attributes: `Secure; HttpOnly; SameSite=Lax; Path=/; __Host-tb_session` for the session; `Secure; SameSite=Strict` for `tb_csrf`. Mutating route handlers require the `x-csrf-token` header to match `tb_csrf`.

## 7. Uploads

- Allowlist: MIME `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/pdf`. Extension must agree.
- Size cap: 25 MB (configurable). Enforced at presign and verified post-upload.
- Server does **not** parse at upload time — only the Python service parses, in a sandboxed container with no network egress except to S3, LLM provider (if enabled), and the Next.js callback endpoint.
- Virus scan (optional): ClamAV sidecar on the ingestion service; results attached to `IngestionJob`.

## 8. LLM-specific controls

- Prompt is **fixed** server-side; user-supplied text is isolated into a dedicated section with explicit "treat as content, not instructions" framing.
- Response is JSON-only; parsed with Pydantic; any deviation triggers one repair pass then falls through to the safe `custom`-section mode (per `05-ai-ingestion.md`).
- No tool-use/function-calling from the LLM in v1.
- Opt-out: tenant setting `allow_llm_processing=false` disables the extract stage entirely.
- Data residency: configurable `llm_region` per tenant; providers that cannot honor it are not selectable.
- Zero-retention: use provider zero-retention / BAA endpoints where available. Record which was used on each job.

## 9. Secrets management

- Dev: `.env.local` git-ignored.
- Preview/prod: Vercel / Fly secrets, scoped per environment.
- Rotation: service tokens 30d, OIDC secrets per IdP policy, LLM keys 90d, DB credentials 180d.
- `.env*.example` lists every required variable with a safe default or placeholder. CI fails if the real env is missing one.

## 10. Audit log

- Authentication events append to `auth.audit_event` (login success and failure, logout, password reset, email verification, role change).
- Article and admin events append to a business `audit_log` table, specified here and built with the feature that emits them (publish, unpublish, archive, rollback, integration config, bulk operations). Admin impersonation is not in v1.
- Both are mirrored to a tamper-evident external store in regulated deployments.
- Entry: `ts, actorUserId, action, resourceType, resourceId, prev?, next?, ip, userAgent`.

## 11. Privacy & retention

| Data                       | Default retention              | Notes                                             |
|----------------------------|--------------------------------|---------------------------------------------------|
| Raw upload (S3)            | 30 days                        | Configurable per tenant                           |
| Artifact bundle (S3)       | 7 days                         | Longer if `job.flagged_for_review=true`           |
| View events (Postgres)     | 90 days (daily rollup)         | Lifetime counter persists; per-event detail drops |
| Audit log                  | 2 years                        | Export on request                                 |
| User account on delete     | 30-day grace, then hard delete | Articles reassigned to a system `former_user`     |

GDPR / local-equivalent: data export and deletion endpoints exposed to admins.

## 12. Compliance target (initial)

- **OWASP ASVS Level 1** must pass before pilot.
- **SOC 2 Type I** readiness within 6 months of GA (controls documented, evidence collected).
- GDPR DSR workflow in place (export + delete).

## 13. Vulnerability management

- Automated: `pnpm audit`, `pip-audit`, `trivy` on container images, in CI nightly.
- Human: quarterly focused review of upload, auth, and LLM boundaries.
- SLA: criticals patched within 72h, highs within 14d, mediums within 30d, lows at next release.
