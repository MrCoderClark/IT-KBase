# auth/py

FastAPI dependency that checks the 60-second HMAC assertion minted by `auth/web`. It does not open Postgres and it does not read the browser session cookie.

The host passes the same `kid:secret` keys the Next.js app uses to sign. Health checks stay outside this dependency. A background job can send `Authorization: Bearer sv_...` when the host configured that credential.

The install steps for a second Next.js + FastAPI app are in `auth/web/README.md`.
