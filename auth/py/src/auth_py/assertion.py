"""HMAC assertion format shared with auth/web `assertion.ts`.

Token: ``v1.<base64url json>.<base64url hmac>``.
JSON keys, in order: aud, exp, gen, iat, kid, role, sub, uid.
The HMAC covers the ASCII string ``v1.<payload>``.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from base64 import urlsafe_b64decode, urlsafe_b64encode
from dataclasses import dataclass
from datetime import datetime

ASSERTION_TTL_SECONDS = 60
ASSERTION_AUDIENCE = "ingestion"
_CLAIM_KEYS = ("aud", "exp", "gen", "iat", "kid", "role", "sub", "uid")


class AssertionError(Exception):
    """The bearer token is not a valid assertion. The message is for logs, not clients."""


@dataclass(frozen=True)
class AssertionClaims:
    aud: str
    exp: int
    gen: int
    iat: int
    kid: str
    role: str
    sub: str
    uid: str


def parse_assertion_keys(raw: str | None) -> dict[str, bytes]:
    keys: dict[str, bytes] = {}
    if not raw:
        return keys
    for part in raw.split(","):
        trimmed = part.strip()
        if not trimmed or ":" not in trimmed:
            continue
        kid, secret = trimmed.split(":", 1)
        kid = kid.strip()
        if kid and secret:
            keys[kid] = secret.encode("utf-8")
    return keys


def verify_assertion(
    token: str,
    keys: dict[str, bytes],
    now: datetime,
    audience: str = ASSERTION_AUDIENCE,
) -> AssertionClaims:
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != "v1" or not parts[1] or not parts[2]:
        raise AssertionError("malformed")
    payload, signature = parts[1], parts[2]
    try:
        decoded = json.loads(_b64decode(payload))
    except (ValueError, json.JSONDecodeError) as exc:
        raise AssertionError("payload") from exc
    if not isinstance(decoded, dict) or not isinstance(decoded.get("kid"), str):
        raise AssertionError("payload")
    secret = keys.get(decoded["kid"])
    if secret is None:
        raise AssertionError("unknown kid")

    expected = _sign(payload, secret)
    if not hmac.compare_digest(signature.encode("ascii"), expected.encode("ascii")):
        raise AssertionError("signature")

    try:
        claims = AssertionClaims(
            aud=str(decoded["aud"]),
            exp=int(decoded["exp"]),
            gen=int(decoded["gen"]),
            iat=int(decoded["iat"]),
            kid=str(decoded["kid"]),
            role=str(decoded["role"]),
            sub=str(decoded["sub"]),
            uid=str(decoded["uid"]),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise AssertionError("claims") from exc

    now_seconds = int(now.timestamp())
    if claims.aud != audience:
        raise AssertionError("audience")
    if claims.exp - claims.iat > ASSERTION_TTL_SECONDS:
        raise AssertionError("lifetime")
    if claims.iat > now_seconds + 5:
        raise AssertionError("issued-at")
    if claims.exp <= now_seconds - 5:
        raise AssertionError("expired")
    return claims


def mint_assertion(claims: AssertionClaims, secret: bytes) -> str:
    ordered = {key: getattr(claims, key) for key in _CLAIM_KEYS}
    payload = _b64encode(json.dumps(ordered, separators=(",", ":")).encode("utf-8"))
    return f"v1.{payload}.{_sign(payload, secret)}"


def _sign(payload: str, secret: bytes) -> str:
    mac = hmac.new(secret, f"v1.{payload}".encode("ascii"), hashlib.sha256).digest()
    return _b64encode(mac)


def _b64encode(data: bytes) -> str:
    return urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return urlsafe_b64decode(data + padding)
