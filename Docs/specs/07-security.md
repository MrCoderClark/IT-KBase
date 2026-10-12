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

- **Primary**: Auth.js (NextAuth) with:
  - **Credentials** provider in dev / self-hosted modes.
  - **OIDC** provider in enterprise mode (Entra ID / Okta / Google Workspace).
- Password rules (credentials): min 12 chars, must include 3 of {upper, lower, digit, symbol}, zxcvbn score ≥ 3. Breach check against HIBP range API.
- Sessions:
  - Server-side session via the Redis adapter.
  - TTL 7 days absolute, 24h sliding.
  - On role change, all existing sessions for that user are invalidated.

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
| Manage users / integrations / settings                |        |        |          | ✅    |

Enforcement:
- **Every** server action / API route checks `canUserDoX(user, resource)` with a central policy module (`apps/web/lib/auth/policy.ts`). No ad-hoc checks.
- Policy is table-driven and unit-tested.
- UI hiding is a usability layer, not a security layer.

## 4. Data classification

| Class            | Examples                                       | Handling                                                   |
|------------------|------------------------------------------------|------------------------------------------------------------|
| Public           | Marketing site content                         | n/a (not in this app in v1)                                 |
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

Cookie attributes: `Secure; HttpOnly; SameSite=Lax; Path=/; __Host-` for session; `Secure; SameSite=Strict` for CSRF.

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

- Appended to a `audit_log` table (and mirrored to a tamper-evident external store in regulated deployments).
- Captured events: login success/failure, role change, article publish/unpublish/archive/rollback, integration config change, bulk operations, admin impersonation (if ever added — not in v1).
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
