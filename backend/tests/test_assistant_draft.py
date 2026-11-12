"""POST /assistant/draft and the drafter. No real model call."""

from __future__ import annotations

import json
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from auth_py.assertion import AssertionClaims, mint_assertion
from backend.app import create_app
from backend.assistant.drafter import (
    DraftError,
    FakeDrafter,
    OpenAICompatibleDrafter,
)
from backend.config import get_settings

NOW = datetime(2026, 11, 12, 16, 0, tzinfo=UTC)
SECRET = b"test-assertion-key"
SERVICE_TOKEN = "sv_test_worker"

STRUCTURED = {
    "title": "Reset the local administrator password",
    "summary": "Recover admin access when the password is lost.",
    "overview": "Boot into recovery and re-enable the account.",
    "prerequisites": ["Bootable Windows 11 media"],
    "steps": [{"title": "Boot into WinRE", "body": "Hold Shift and restart.", "code": "net user Administrator /active:yes"}],
    "verification": ["Sign in with the new password"],
    "troubleshooting": [{"title": "WinRE missing", "body": "Use installation media."}],
}


class _FrozenClock:
    @staticmethod
    def now(_tz=None):
        return NOW


@pytest.fixture
def api(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("TB_ASSERTION_KEYS", "k1:test-assertion-key")
    monkeypatch.setenv("TB_SERVICE_TOKENS", SERVICE_TOKEN)
    monkeypatch.setenv("TB_ENV", "preview")
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        yield client
    get_settings.cache_clear()


def _user(monkeypatch: pytest.MonkeyPatch, role: str = "author") -> dict[str, str]:
    monkeypatch.setattr("auth_py.dependency.datetime", _FrozenClock)
    token = mint_assertion(
        AssertionClaims(
            aud="ingestion",
            exp=int(NOW.timestamp()) + 60,
            gen=1,
            iat=int(NOW.timestamp()),
            kid="k1",
            role=role,
            sub="id1",
            uid="user1",
        ),
        SECRET,
    )
    return {"Authorization": f"Bearer {token}"}


def _use_drafter(monkeypatch: pytest.MonkeyPatch, drafter: object | None) -> None:
    monkeypatch.setattr("backend.api.assistant.get_drafter", lambda: drafter)


# --- drafter ---------------------------------------------------------------


def test_structures_notes_into_canonical_sections() -> None:
    drafter = OpenAICompatibleDrafter(
        api_key="k", model="m", base_url="u", complete=lambda _messages: json.dumps(STRUCTURED)
    )
    draft = drafter.draft(notes="reset admin password runbook")
    assert draft.title == "Reset the local administrator password"
    assert draft.steps[0].code == "net user Administrator /active:yes"
    assert draft.prerequisites == ["Bootable Windows 11 media"]
    # Drafted callouts default to the warning variant.
    assert draft.troubleshooting[0].variant == "warning"


def test_one_repair_then_success() -> None:
    calls: list[object] = []

    def complete(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return "not json" if len(calls) == 1 else json.dumps({"title": "Fixed", "steps": []})

    drafter = OpenAICompatibleDrafter(api_key="k", model="m", base_url="u", complete=complete)
    draft = drafter.draft(notes="x")
    assert draft.title == "Fixed"
    assert len(calls) == 2  # original + one repair


def test_invalid_twice_raises_draft_error() -> None:
    drafter = OpenAICompatibleDrafter(
        api_key="k", model="m", base_url="u", complete=lambda _messages: "still not json"
    )
    with pytest.raises(DraftError):
        drafter.draft(notes="x")


def test_blank_notes_raise_draft_error() -> None:
    drafter = OpenAICompatibleDrafter(api_key="k", model="m", base_url="u", complete=lambda _m: "{}")
    with pytest.raises(DraftError):
        drafter.draft(notes="   ")


def test_fake_drafter_uses_first_line_as_title() -> None:
    draft = FakeDrafter().draft(notes="Reset password\nmore detail here")
    assert draft.title == "Reset password"
    assert "more detail here" in draft.overview


# --- endpoint --------------------------------------------------------------


def test_author_drafts_from_notes(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_drafter(monkeypatch, FakeDrafter())
    response = api.post(
        "/assistant/draft",
        json={"notes": "Reset the admin password", "mode": "notes"},
        headers=_user(monkeypatch, "author"),
    )
    assert response.status_code == 200
    assert response.json()["draft"]["title"] == "Reset the admin password"


def test_reader_is_forbidden(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_drafter(monkeypatch, FakeDrafter())
    response = api.post(
        "/assistant/draft", json={"notes": "x"}, headers=_user(monkeypatch, "reader")
    )
    assert response.status_code == 403


def test_requires_a_caller(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_drafter(monkeypatch, FakeDrafter())
    response = api.post("/assistant/draft", json={"notes": "x"})
    assert response.status_code == 401


def test_service_token_is_allowed(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_drafter(monkeypatch, FakeDrafter())
    response = api.post(
        "/assistant/draft",
        json={"notes": "x"},
        headers={"Authorization": f"Bearer {SERVICE_TOKEN}"},
    )
    assert response.status_code == 200


def test_not_configured_is_503(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_drafter(monkeypatch, None)
    response = api.post(
        "/assistant/draft", json={"notes": "x"}, headers=_user(monkeypatch, "author")
    )
    assert response.status_code == 503
