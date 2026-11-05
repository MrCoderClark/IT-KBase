"""POST /assistant/answer, post-validation, and the answerers. No real model call."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from auth_py.assertion import AssertionClaims, mint_assertion
from backend.app import create_app
from backend.assistant.answerer import (
    BundleChunk,
    DoneEvent,
    FakeAnswerer,
    TokenEvent,
    validate_answer,
)
from backend.config import get_settings

NOW = datetime(2026, 11, 5, 16, 0, tzinfo=UTC)
SECRET = b"test-assertion-key"
SERVICE_TOKEN = "sv_test_worker"

PROSE = BundleChunk(n=1, chunkId="c1", kind="prose", sectionTitle="Overview", text="Reset the password.")
CODE = BundleChunk(n=2, chunkId="c2", kind="code", sectionTitle="Steps", text="net user Administrator /active:yes")
BUNDLE = [PROSE, CODE]


class _FrozenClock:
    @staticmethod
    def now(_tz=None):
        return NOW


@pytest.fixture
def api(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("TB_ASSERTION_KEYS", "k1:test-assertion-key")
    monkeypatch.setenv("TB_SERVICE_TOKENS", SERVICE_TOKEN)
    monkeypatch.setenv("TB_ENV", "preview")  # keep the unit test off the local S3 path
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        yield client
    get_settings.cache_clear()


def _user(monkeypatch: pytest.MonkeyPatch, role: str = "reader") -> dict[str, str]:
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


def _use(monkeypatch: pytest.MonkeyPatch, answerer: object | None) -> None:
    monkeypatch.setattr("backend.api.assistant.get_answerer", lambda: answerer)


def _bundle_json() -> list[dict]:
    return [chunk.model_dump() for chunk in BUNDLE]


def _events(text: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for block in text.split("\n\n"):
        name = data = ""
        for line in block.splitlines():
            if line.startswith("event:"):
                name = line[len("event:") :].strip()
            elif line.startswith("data:"):
                data = line[len("data:") :].strip()
        if name:
            out.append((name, data))
    return out


# --- post-validation --------------------------------------------------------


def test_drops_citations_not_in_the_bundle() -> None:
    clean, citations = validate_answer("See [1] and [9].", BUNDLE)
    assert citations == [1]
    assert "[9]" not in clean


def test_keeps_a_verbatim_command_and_removes_an_invented_one() -> None:
    verbatim = "Run [2]:\n```\nnet user Administrator /active:yes\n```"
    clean, _ = validate_answer(verbatim, BUNDLE)
    assert "net user Administrator /active:yes" in clean

    invented = "Run this:\n```\nformat C: /y\n```"
    clean, _ = validate_answer(invented, BUNDLE)
    assert "format C:" not in clean
    assert "Command not found in KB" in clean


# --- answerers --------------------------------------------------------------


def test_fake_answerer_cites_and_quotes_code() -> None:
    events = list(FakeAnswerer().answer("reset admin password", BUNDLE, []))
    assert any(isinstance(e, TokenEvent) for e in events)
    done = events[-1]
    assert isinstance(done, DoneEvent)
    assert done.grounded is True
    assert done.citations == [1, 2]
    assert "net user Administrator /active:yes" in done.answer


def test_empty_bundle_is_not_grounded() -> None:
    events = list(FakeAnswerer().answer("anything", [], []))
    assert len(events) == 1
    done = events[0]
    assert isinstance(done, DoneEvent)
    assert done.grounded is False
    assert done.citations == []


# --- endpoint ---------------------------------------------------------------


def test_reader_streams_tokens_then_done(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, FakeAnswerer())
    response = api.post(
        "/assistant/answer",
        json={"question": "reset the local admin password", "bundle": _bundle_json()},
        headers=_user(monkeypatch, "reader"),
    )
    assert response.status_code == 200
    events = _events(response.text)
    names = [name for name, _ in events]
    assert "token" in names
    assert names[-1] == "done"
    assert '"grounded": true' in events[-1][1]


def test_service_token_is_allowed(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, FakeAnswerer())
    response = api.post(
        "/assistant/answer",
        json={"question": "x", "bundle": _bundle_json()},
        headers={"Authorization": f"Bearer {SERVICE_TOKEN}"},
    )
    assert response.status_code == 200


def test_requires_a_caller(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, FakeAnswerer())
    response = api.post("/assistant/answer", json={"question": "x", "bundle": _bundle_json()})
    assert response.status_code == 401


def test_not_configured_is_503(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, None)
    response = api.post(
        "/assistant/answer",
        json={"question": "x", "bundle": _bundle_json()},
        headers=_user(monkeypatch),
    )
    assert response.status_code == 503
