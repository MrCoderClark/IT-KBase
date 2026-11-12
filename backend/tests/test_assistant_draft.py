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
    DraftRequest,
    FakeDrafter,
    OpenAICompatibleDrafter,
    TaxonomyOption,
    TidyRequest,
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


def _notes(notes: str) -> DraftRequest:
    return DraftRequest(mode="notes", notes=notes)


def test_structures_notes_into_canonical_sections() -> None:
    drafter = OpenAICompatibleDrafter(
        api_key="k", model="m", base_url="u", complete=lambda _messages: json.dumps(STRUCTURED)
    )
    draft = drafter.draft(_notes("reset admin password runbook"))
    assert draft.title == "Reset the local administrator password"
    assert draft.steps[0].code == "net user Administrator /active:yes"
    assert draft.prerequisites == ["Bootable Windows 11 media"]
    # Drafted callouts default to the warning variant.
    assert draft.troubleshooting[0].variant == "warning"


def test_prompt_mode_grounds_taxonomy_hints() -> None:
    seen: dict[str, str] = {}

    def complete(messages: list[dict[str, str]]) -> str:
        seen["user"] = messages[-1]["content"]
        return json.dumps({"title": "Rotate the app secret", "steps": []})

    drafter = OpenAICompatibleDrafter(api_key="k", model="m", base_url="u", complete=complete)
    draft = drafter.draft(
        DraftRequest(
            mode="prompt",
            prompt="Write a runbook for rotating the Entra ID app secret",
            categories=["Identity"],
            tags=["Entra ID"],
        )
    )
    assert draft.title == "Rotate the app secret"
    assert "Entra ID app secret" in seen["user"]
    assert "Identity" in seen["user"]  # category hint reaches the model
    assert "Entra ID" in seen["user"]  # tag hint reaches the model


def test_one_repair_then_success() -> None:
    calls: list[object] = []

    def complete(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return "not json" if len(calls) == 1 else json.dumps({"title": "Fixed", "steps": []})

    drafter = OpenAICompatibleDrafter(api_key="k", model="m", base_url="u", complete=complete)
    draft = drafter.draft(_notes("x"))
    assert draft.title == "Fixed"
    assert len(calls) == 2  # original + one repair


def test_invalid_twice_raises_draft_error() -> None:
    drafter = OpenAICompatibleDrafter(
        api_key="k", model="m", base_url="u", complete=lambda _messages: "still not json"
    )
    with pytest.raises(DraftError):
        drafter.draft(_notes("x"))


def test_blank_input_raises_draft_error() -> None:
    drafter = OpenAICompatibleDrafter(api_key="k", model="m", base_url="u", complete=lambda _m: "{}")
    with pytest.raises(DraftError):
        drafter.draft(_notes("   "))
    with pytest.raises(DraftError):
        drafter.draft(DraftRequest(mode="prompt", prompt="  "))


def test_fake_drafter_uses_first_line_as_title() -> None:
    draft = FakeDrafter().draft(_notes("Reset password\nmore detail here"))
    assert draft.title == "Reset password"
    assert "more detail here" in draft.overview


# --- tidy ------------------------------------------------------------------


def test_tidy_maps_chosen_names_to_slugs_and_drops_invented() -> None:
    written = {
        "title": "Reset the admin password",
        "summary": "Recover access.",
        "overview": "...",
        "steps": [],
        "category": "Windows",  # matches by name, case-insensitive below
        "tags": ["Windows 11", "Totally Made Up", "Recovery"],
    }
    drafter = OpenAICompatibleDrafter(
        api_key="k", model="m", base_url="u", complete=lambda _m: json.dumps(written)
    )
    result = drafter.tidy(
        TidyRequest(
            content="messy draft text",
            categories=[TaxonomyOption(slug="windows", name="windows")],
            tags=[
                TaxonomyOption(slug="windows-11", name="Windows 11"),
                TaxonomyOption(slug="recovery", name="Recovery"),
            ],
        )
    )
    assert result.draft.title == "Reset the admin password"
    assert result.category_slug == "windows"
    # "Totally Made Up" is not in the offered tags, so it is dropped.
    assert result.tag_slugs == ["windows-11", "recovery"]


def test_tidy_empty_content_raises() -> None:
    drafter = OpenAICompatibleDrafter(api_key="k", model="m", base_url="u", complete=lambda _m: "{}")
    with pytest.raises(DraftError):
        drafter.tidy(TidyRequest(content="   "))


def test_author_tidies_a_draft(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_drafter(monkeypatch, FakeDrafter())
    response = api.post(
        "/assistant/tidy",
        json={
            "content": "Reset the admin password\nsome messy notes",
            "categories": [{"slug": "windows", "name": "Windows"}],
            "tags": [{"slug": "recovery", "name": "Recovery"}],
        },
        headers=_user(monkeypatch, "author"),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["draft"]["title"] == "Reset the admin password"
    assert data["categorySlug"] == "windows"
    assert data["tagSlugs"] == ["recovery"]


def test_tidy_requires_author(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_drafter(monkeypatch, FakeDrafter())
    response = api.post(
        "/assistant/tidy", json={"content": "x"}, headers=_user(monkeypatch, "reader")
    )
    assert response.status_code == 403


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


def test_author_drafts_from_prompt(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use_drafter(monkeypatch, FakeDrafter())
    response = api.post(
        "/assistant/draft",
        json={"mode": "prompt", "prompt": "Rotate the Entra ID app secret", "tags": ["Entra ID"]},
        headers=_user(monkeypatch, "author"),
    )
    assert response.status_code == 200
    assert response.json()["draft"]["title"] == "Rotate the Entra ID app secret"


def test_prompt_mode_without_a_prompt_is_422(
    api: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _use_drafter(monkeypatch, FakeDrafter())
    response = api.post(
        "/assistant/draft",
        json={"mode": "prompt", "prompt": "  "},
        headers=_user(monkeypatch, "author"),
    )
    assert response.status_code == 422


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
