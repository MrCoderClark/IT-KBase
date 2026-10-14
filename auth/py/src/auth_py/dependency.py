"""FastAPI dependency. The host supplies keys; this module does not read the environment."""

from __future__ import annotations

import hmac
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from fastapi import HTTPException, Request

from auth_py.assertion import AssertionError, verify_assertion


@dataclass(frozen=True)
class Principal:
    kind: Literal["user", "service"]
    identity_id: str | None = None
    user_id: str | None = None
    role: str | None = None
    session_gen: int | None = None


def require_principal(
    keys: dict[str, bytes],
    service_tokens: set[str],
    audience: str = "ingestion",
):
    async def dependency(request: Request) -> Principal:
        header = request.headers.get("authorization")
        if not header or not header.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Missing bearer token")
        token = header.split(" ", 1)[1].strip()
        if token.startswith("sv_"):
            if not any(hmac.compare_digest(token, item) for item in service_tokens):
                raise HTTPException(status_code=401, detail="Invalid bearer token")
            return Principal(kind="service")
        try:
            claims = verify_assertion(token, keys, datetime.now(UTC), audience)
        except AssertionError:
            raise HTTPException(status_code=401, detail="Invalid bearer token") from None
        return Principal(
            kind="user",
            identity_id=claims.sub,
            user_id=claims.uid,
            role=claims.role,
            session_gen=claims.gen,
        )

    return dependency
