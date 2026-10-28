# auth/web

Session and password-login core for a Next.js host. This folder does not import a host application's pages, database client, or domain models.

The host supplies two things:

- a `PasswordHasher` (Argon2id, memory 19 MiB, iterations 2, parallelism 1)
- an `AuthStore` that reads and writes the `auth` tables

TechBase's adapter is `frontend/lib/auth/`. Cookie names, the assertion secret, and the database URL stay in the host environment.

`mintAssertion` builds `v1.<payload>.<signature>`, an HMAC-SHA256 token that lasts 60 seconds. The host and FastAPI share `kid:secret` keys. FastAPI verifies the token and does not read the session cookie.

See `Docs/specs/adr/0001-server-managed-sessions.md`.

## Installing this in another app

Copy `auth/web` and `auth/py` into the other repo. Leave them free of that app's pages, database client, and domain models. TechBase reaches them with a relative import (`../../../auth/web/src` from `frontend/lib/auth`) and sets Turbopack's root to the parent of `frontend/` so that import is allowed.

The other app owns four host pieces:

1. **Tables.** Create a Postgres schema named `auth` with `identity`, `session`, `email_token`, `login_attempt`, and `audit_event`. The column list is the migration `frontend/prisma/migrations/20261014173850_auth_schema/migration.sql`. Authenticator and passkey tables are the later migrations in that folder. Point the app's user row at `identity.id` with its own `identityId` column. Do not put a foreign key from `auth` back into the app schema.
2. **`AuthStore`.** Implement the interface in `src/types.ts` against those tables. TechBase's implementation is `frontend/lib/auth/store.ts`.
3. **`PasswordHasher`.** Argon2id with memory 19 MiB, iterations 2, parallelism 1. Inject it. This package does not import a native hasher.
4. **Password strength.** `passwordProblem` needs a host-supplied `score` (zxcvbn ≥ 3). TechBase uses `@zxcvbn-ts/*` from `frontend/lib/auth/zxcvbn-score.ts` and passes it into `completePasswordReset` / admin create. HIBP range lookup lives in auth/web (`fetch` + SHA-1). Unit tests stub `score` and `isBreached`.
5. **Cookie and gate.** On login, call `loginWithPassword`, then set an HttpOnly, Secure, SameSite=Lax cookie (`__Host-` prefix, no Domain, Path=/). On each request, `resolveSession`. Logout calls `revokePresentedSession`. A layout redirect covers every page that requires a sign-in. A public read, if the app has one, is a property of that app's content, not of this module.

Environment the host keeps:

| Name | Where | Purpose |
| --- | --- | --- |
| `AUTH_COOKIE_NAME` | Next.js | Optional. Default `__Host-tb_session`. |
| `AUTH_ASSERTION_KEYS` | Next.js | `kid:secret,kid2:secret`. Empty means `mintIngestionAssertion` returns null. |
| `AUTH_ASSERTION_KID` | Next.js | Optional. Defaults to the first key. |
| `TB_ASSERTION_KEYS` | FastAPI | The same `kid:secret` string. |
| `TB_SERVICE_TOKENS` | FastAPI | Optional comma-separated `sv_...` credentials for background jobs. |
| `AUTH_MFA_KEY` | Next.js | Encrypts the authenticator secret. Empty means enrollment cannot start. |
| `AUTH_WEBAUTHN_RP_ID` | Next.js | Passkey site id, such as `localhost`. Required in production. |
| `AUTH_WEBAUTHN_ORIGIN` | Next.js | Passkey origin, such as `http://localhost:3001`. Required in production. |

Mail, roles, and which routes stay public are the host's. Authenticator enrollment is also the host's: `newTotpSecret`, `matchTotpStep`, `encryptTotpSecret`, and `newRecoveryCodes` stay here, and the host stores the ciphertext. `hasConfirmedMfa` tells `loginWithPassword` to return without creating a session. Passkeys are a separate sign-in. `signatureCounterRegressed` is the clone check; the host verifies the ceremony with `@simplewebauthn/server` and stores the public key. Password reset uses `requestPasswordReset` and `completePasswordReset`; the host sends the link. FastAPI calls `require_principal(keys, service_tokens)` on routes that need a caller and leaves health checks outside that dependency.
