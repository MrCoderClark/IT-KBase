# ADR 0001 — Server-managed sessions

- **Status:** Accepted
- **Date:** 2026-10-14
- **Branch:** `feat/auth-phase-a`

## Context

TechBase has no authentication in code. Articles are attributed to the seeded user `joe.clark@techbase.local`. FastAPI exposes health checks only and does not connect to Postgres. `Docs/specs/07-security.md` previously specified Auth.js with a Redis session adapter and OIDC. That stack is not installed.

The product needs a login on every page, with one exception: a published article may be marked public and then read without a session. FastAPI must enforce authentication on its own routes. The auth code must be reusable in another Next.js + FastAPI application without copying TechBase pages or article models.

Sessions must be revocable. Logout, password reset, and role change have to end access promptly. The browser must not hold a refresh token or other long-lived secret.

## Decision

### Opaque sessions, held by Next.js

The browser receives one session cookie. The cookie value is a random 256-bit id. Postgres stores only a hash of that id, plus expiry, revocation, and the identity it belongs to.

| Boundary | Responsibility |
| --- | --- |
| Browser | Sends the session cookie. Never stores a session secret, refresh token, or access token. |
| Next.js | Validates the cookie, runs login, logout, password reset, and email verification. Mints a short-lived assertion when it calls FastAPI. |
| Postgres | Source of truth for identities, sessions, one-time email tokens, and auth audit events. |
| FastAPI | Rejects requests that lack a valid assertion or service credential. Applies its own permission check. Does not read the auth tables and does not see the browser cookie. |

Cookie settings for TechBase:

- Name: `__Host-tb_session` (the module takes the name from configuration; another app supplies its own).
- `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. No `Domain` attribute, which the `__Host-` prefix requires.
- Lifetime: 7 days absolute, 24 hours idle. Each authenticated request refreshes the idle deadline.

A new session id is issued at login. Logout deletes that session and clears the cookie. Password change, password reset, email change, and role change delete every session for that identity.

CSRF: mutating route handlers require a double-submit token. The CSRF cookie is `tb_csrf`, `Secure`, `SameSite=Strict`, not `HttpOnly`, so the browser can echo it in the `x-csrf-token` header. Server Actions keep Next.js origin checks.

Passwords are hashed with Argon2id (memory 19 MiB, iterations 2, parallelism 1). Reset and verification tokens are 256-bit random values, stored as SHA-256 hashes, single use. Reset tokens expire in 1 hour. Verification tokens expire in 24 hours.

Login attempts are limited to 5 per 10 minutes, counted per client IP and per email address. Phase A stores the counters in Postgres. Redis remains the cache and queue; it is not the session store.

### Why this, after comparing a browser JWT

A stateless JWT in the browser stays valid until it expires. Immediate logout and “invalidate every session on role change” then require a revocation list on every verifier, which is a session store under another name. Auth.js was rejected as the core for the same reason its default session is a JWT, and because its user, account, and session tables are coupled to Next.js. OIDC, SAML, and passkeys remain later phases behind the same session cookie. They do not change what the browser is allowed to hold.

### How Next.js calls FastAPI

Next.js does not forward the session cookie. After the session is valid, it sends:

```
Authorization: Bearer v1.<payload>.<signature>
```

The payload is JSON, signed with HMAC-SHA256 and a key id (`kid`) so a second key can overlap during rotation. Claims: identity id, app user id, role, session generation, audience `ingestion`, issued-at, expiry. Lifetime is 60 seconds. FastAPI checks the signature, the audience, and the expiry, then enforces the permission that route requires. It does not accept this credential from a browser.

A stolen assertion works for at most 60 seconds. Logout stops new assertions immediately. That window is the cost of keeping FastAPI off the auth database, which matches the existing rule that the ingestion service does not open Postgres.

Background jobs keep using the scoped service credential (`Authorization: Bearer sv_...`), rotated every 30 days. Health checks stay unauthenticated.

### Login wall and public articles

Every TechBase page requires a session except:

- `/login`, `/forgot-password`, `/reset-password`, `/verify-email`
- the read view of one article when `status` is `published` and `visibility` is `public`

`visibility` defaults to `private`. Draft, in-review, and archived articles ignore a public flag. The public read view has no sidebar, no edit or share controls, and no links to other articles. Lists, search, categories, and the ingestion API stay authenticated. Marking an article public is allowed for `reviewer` and `admin`, the same roles that can publish.

### Module layout

```
auth/web/    TypeScript package. Cookies, sessions, CSRF, password hashing, email-token flows, assertion minting.
auth/py/     Python package. FastAPI dependency that verifies the assertion.
```

Neither package imports TechBase models, pages, or absolute paths. The host app supplies configuration: cookie name, signing keys, database access, password policy, and an adapter.

```ts
interface AuthAdapter {
  loadPrincipal(identityId: string): Promise<{ appUserId: string; role: string } | null>
}
```

TechBase implements the adapter by reading `User` where `identityId` matches, and passes that role through. Article authorization stays in the app:

```ts
can(principal, "article.read", article)
```

An anonymous principal is allowed `article.read` only for a published public article. Every other capability uses the role matrix in `07-security.md`. The frontend hiding a button is not the check.

### Tables

Auth-owned tables live in a Postgres schema named `auth`. Prisma in the host app applies the migrations. FastAPI does not migrate them.

| Table | Purpose |
| --- | --- |
| `auth.identity` | Email, Argon2id hash, verification, disabled flag |
| `auth.session` | Hashed session id, expiry, idle deadline, revocation, user agent |
| `auth.email_token` | Hashed single-use reset and verification tokens |
| `auth.login_attempt` | Rate-limit counters |
| `auth.audit_event` | Login, logout, failure, reset, role change |

`User.identityId` is a unique nullable link to `auth.identity`. Existing article foreign keys stay on `User`. Seeded users gain an identity and a development password when the seed is updated. Production does not ship that password.

Email delivery is an interface. Local development writes the link to the server log.

### Phases

**Phase A (this decision, implemented incrementally):** configuration, tables, password login, sessions, logout and revocation, reset and email verification, Next.js server gate, FastAPI assertion check, role-matrix foundation, auth audit events, login rate limiting, public-article read exception, tests, and a written second-app integration.

**Later:** MFA and recovery codes, permissions finer than the four roles, organizations, Entra ID, Google Workspace, SAML 2.0, passkeys, admin policy screens, session and device management UI.

A feature is not done until its tests have been run and the result is recorded in `progress.md`.

## Consequences

- `07-security.md`, `01-architecture.md`, `03-data-model.md`, and `06-api.md` follow this ADR. The Auth.js and Redis-session lines in those docs are retired.
- The first code slice adds the `auth` schema and the link on `User`. It does not change article columns except `visibility` when that slice starts.
- Signing-key compromise lets the holder mint 60-second assertions. Keys live in the environment, never in the repo, and rotate by accepting the previous `kid` until it is removed.
- Anonymous visitors learn nothing about the catalog except the public article they were given a link to.

## Configuration the host app must set

| Variable | Purpose |
| --- | --- |
| `AUTH_COOKIE_NAME` | Session cookie. TechBase: `__Host-tb_session` |
| `AUTH_CSRF_COOKIE_NAME` | CSRF cookie. TechBase: `tb_csrf` |
| `AUTH_ASSERTION_SECRET` | HMAC key for the FastAPI assertion. Required in every environment. |
| `AUTH_ASSERTION_KEY_ID` | `kid` written into the assertion. |
| `DATABASE_URL` | Host database. The auth tables share it. |

OIDC client secrets are not required until that phase.
