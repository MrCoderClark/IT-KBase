# ADR 0002 — WebAuthn passkeys

- **Status:** Accepted
- **Date:** 2026-10-14
- **Branch:** `feat/auth-passkeys`

## Context

Phase A issues an opaque session cookie after a password check. Phase B MFA can hold that cookie until a one-time code succeeds. Passkeys are a separate sign-in method: the authenticator unlocks the device, so a successful ceremony should set the same cookie without a second code.

Verifying a WebAuthn assertion means checking CBOR, COSE, and the signature over authenticator data. A hand-rolled check is how this login fails in ways that look like success.

## Decision

Use `@simplewebauthn/server` to verify registration and authentication, and `@simplewebauthn/browser` to start the ceremony in the page. The host (TechBase) calls those libraries. `auth/web` keeps the counter rule and the display-name rule, which do not need the library.

- Attestation is `none`. User verification is required. Credentials are discoverable, so sign-in does not ask for an email first.
- The relying party id and origin come from `AUTH_WEBAUTHN_RP_ID` and `AUTH_WEBAUTHN_ORIGIN`. The display name stays in the host.
- Postgres stores the credential id, public key, and signature counter. The private key never reaches the server.
- The ceremony challenge lasts 5 minutes, is bound to an HttpOnly cookie, and is not a session.
- A counter that does not move forward after either side has left 0 is rejected. A synced passkey that stays at 0 is accepted.
- Success sets `__Host-tb_session`. Password login, including the authenticator step, is unchanged.

## Consequences

- Two npm packages, pinned by the frontend lockfile.
- Another app that copies `auth/web` still supplies its own ceremony, tables, and those two packages if it wants passkeys. Password login does not require them.
- Requiring a passkey, device attestation, and an admin policy are out of this decision.
