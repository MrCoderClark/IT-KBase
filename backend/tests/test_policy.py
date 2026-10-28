"""Capability matrix matches Docs/specs/07-security.md and the Next.js policy."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from auth_py import Principal
from backend.policy import ROLES, can, require_capability


def test_every_signed_in_role_can_read() -> None:
    for role in ROLES:
        assert can(role, "article.read") is True


def test_matrix_matches_security_spec() -> None:
    assert can("reviewer", "admin.manage") is False
    assert can("admin", "admin.manage") is True
    assert can("author", "article.publish") is False
    assert can("reviewer", "article.publish") is True
    assert can("reviewer", "article.archive") is False
    assert can("admin", "article.archive") is True
    assert can("reviewer", "article.delete") is False
    assert can("admin", "article.delete") is True
    assert can("reader", "article.create") is False
    assert can("author", "article.create") is True


def test_unknown_or_missing_role_is_denied() -> None:
    assert can(None, "article.create") is False
    assert can("guest", "article.read") is False


def test_require_capability_rejects_readers_and_services() -> None:
    with pytest.raises(HTTPException) as denied:
        require_capability(
            Principal(kind="user", user_id="u1", role="reader"),
            "article.create",
            detail="You cannot import articles.",
        )
    assert denied.value.status_code == 403
    assert denied.value.detail == "You cannot import articles."

    with pytest.raises(HTTPException) as service:
        require_capability(Principal(kind="service"), "article.create")
    assert service.value.status_code == 403


def test_require_capability_allows_an_author() -> None:
    require_capability(
        Principal(kind="user", user_id="u1", role="author"),
        "article.create",
    )
