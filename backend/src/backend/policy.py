"""Role matrix from Docs/specs/07-security.md.

Mirrors frontend/lib/auth/policy.ts. FastAPI checks this itself — it does not
trust the Next.js gate. auth_py stays free of article capabilities.
"""

from __future__ import annotations

from typing import Literal

from fastapi import HTTPException

from auth_py import Principal

Role = Literal["reader", "author", "reviewer", "admin"]
Capability = Literal[
    "article.read",
    "article.feedback",
    "article.create",
    "article.editOwn",
    "article.submit",
    "article.editAny",
    "article.publish",
    "article.rollback",
    "article.archive",
    "article.delete",
    "article.makePublic",
    "admin.manage",
]

ROLES: tuple[Role, ...] = ("reader", "author", "reviewer", "admin")

_ALLOWED: dict[Capability, frozenset[Role]] = {
    "article.read": frozenset(ROLES),
    "article.feedback": frozenset(ROLES),
    "article.create": frozenset({"author", "reviewer", "admin"}),
    "article.editOwn": frozenset({"author", "reviewer", "admin"}),
    "article.submit": frozenset({"author", "reviewer", "admin"}),
    "article.editAny": frozenset({"reviewer", "admin"}),
    "article.publish": frozenset({"reviewer", "admin"}),
    "article.rollback": frozenset({"admin"}),
    "article.archive": frozenset({"admin"}),
    "article.delete": frozenset({"admin"}),
    "article.makePublic": frozenset({"reviewer", "admin"}),
    "admin.manage": frozenset({"admin"}),
}


def can(role: str | None, capability: Capability) -> bool:
    if role not in _ALLOWED[capability]:
        return False
    return True


def require_capability(
    principal: Principal,
    capability: Capability,
    *,
    detail: str = "You do not have permission to do that.",
) -> None:
    """Raise 403 unless this is a user principal with the capability."""
    if principal.kind != "user" or not can(principal.role, capability):
        raise HTTPException(status_code=403, detail=detail)
