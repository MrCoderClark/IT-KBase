"""POST /assistant/rerank and the reranker. No test calls a real provider."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from urllib import error

import pytest
from fastapi.testclient import TestClient

from auth_py.assertion import AssertionClaims, mint_assertion
from backend.app import create_app
from backend.assistant.reranker import (
    FakeReranker,
    OpenAICompatibleReranker,
    RerankCandidate,
    RerankError,
    RerankRequest,
    RerankResult,
    get_reranker,
    to_rerank_result,
)
from backend.config import AssistantSettings, get_settings

NOW = datetime(2026, 11, 16, 16, 0, tzinfo=UTC)
SECRET = b"test-assertion-key"
SERVICE_TOKEN = "sv_test_worker"


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


def _use(monkeypatch: pytest.MonkeyPatch, reranker: Any) -> None:
    monkeypatch.setattr("backend.api.assistant.get_reranker", lambda: reranker)


def _payload(**overrides: Any) -> dict[str, Any]:
    body = {
        "question": "Autopilot error 0x80180014",
        "candidates": [
            {"id": "a", "title": "Autopilot overview", "text": "Autopilot sets up Windows devices."},
            {"id": "b", "title": "Autopilot errors", "text": "Fails with 0x80180014 during enrollment."},
        ],
    }
    body.update(overrides)
    return body


# --- endpoint ---------------------------------------------------------------


def test_reader_gets_scores_for_every_candidate(
    api: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _use(monkeypatch, FakeReranker())
    response = api.post(
        "/assistant/rerank",
        json=_payload(),
        headers=_user(monkeypatch, "reader"),
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body["scores"].keys()) == {"a", "b"}
    # The question has an exact error code in candidate b, so b must score higher.
    assert body["scores"]["b"] > body["scores"]["a"]


def test_worker_service_token_is_allowed(
    api: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _use(monkeypatch, FakeReranker())
    response = api.post(
        "/assistant/rerank",
        json=_payload(),
        headers={"Authorization": f"Bearer {SERVICE_TOKEN}"},
    )
    assert response.status_code == 200


def test_requires_a_caller(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, FakeReranker())
    response = api.post("/assistant/rerank", json=_payload())
    assert response.status_code == 401


def test_not_configured_is_503(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, None)
    response = api.post("/assistant/rerank", json=_payload(), headers=_user(monkeypatch))
    assert response.status_code == 503
    assert response.json()["detail"] == "The AI Assistant is not configured."


def test_provider_failure_is_502(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    class Broken:
        def rerank(self, req: RerankRequest) -> RerankResult:
            raise RerankError("The assistant model could not be reached.")

    _use(monkeypatch, Broken())
    response = api.post("/assistant/rerank", json=_payload(), headers=_user(monkeypatch))
    assert response.status_code == 502
    assert response.json()["detail"] == "The assistant model could not be reached."


@pytest.mark.parametrize(
    "payload",
    [
        {"question": "x", "candidates": []},
        {"question": "", "candidates": [{"id": "a", "text": "y"}]},
        {"question": "x", "candidates": [{"id": "", "text": "y"}]},
        {"question": "x", "candidates": [{"id": "a", "text": ""}]},
        {"question": "x", "candidates": [{"id": "a", "text": "y"}] * 25},
    ],
)
def test_rejects_bad_input(
    api: TestClient, monkeypatch: pytest.MonkeyPatch, payload: dict[str, Any]
) -> None:
    _use(monkeypatch, FakeReranker())
    response = api.post("/assistant/rerank", json=payload, headers=_user(monkeypatch))
    assert response.status_code == 422


# --- reranker ---------------------------------------------------------------


def test_fake_reranker_scores_by_overlap() -> None:
    reranker = FakeReranker()
    result = reranker.rerank(
        RerankRequest(
            question="reset vpn tunnel",
            candidates=[
                RerankCandidate(id="a", title="Networking", text="The vpn tunnel resets at noon."),
                RerankCandidate(id="b", title="Printers", text="Unrelated prose."),
            ],
        )
    )
    # Candidate a contains 'reset', 'vpn', 'tunnel'; b contains none.
    assert result.scores["a"] == 1.0
    assert result.scores["b"] == 0.0


def test_fake_reranker_passes_single_candidate_through() -> None:
    reranker = FakeReranker()
    result = reranker.rerank(
        RerankRequest(
            question="anything",
            candidates=[RerankCandidate(id="only", title="t", text="text")],
        )
    )
    # One candidate — no reorder possible, caller keeps the fused order.
    assert result.scores == {}


def test_openai_compatible_sends_model_and_question_and_scores() -> None:
    seen: dict[str, Any] = {}

    def complete(messages: list[dict[str, str]]) -> str:
        seen["messages"] = messages
        return '{"scores": {"a": 0.2, "b": 0.9}}'

    reranker = OpenAICompatibleReranker(
        api_key="sk-test",
        base_url="https://openrouter.ai/api/v1",
        model="openai/gpt-4o-mini",
        complete=complete,
    )
    result = reranker.rerank(
        RerankRequest(
            question="Autopilot 0x80180014",
            candidates=[
                RerankCandidate(id="a", title="Overview", text="General autopilot info."),
                RerankCandidate(id="b", title="Errors", text="0x80180014 during enrollment."),
            ],
        )
    )
    user_prompt = seen["messages"][1]["content"]
    assert "Autopilot 0x80180014" in user_prompt
    assert "[a]" in user_prompt
    assert "[b]" in user_prompt
    assert result.scores == {"a": 0.2, "b": 0.9}


def test_openai_compatible_repairs_once_on_bad_json() -> None:
    calls: list[int] = []

    def complete(messages: list[dict[str, str]]) -> str:
        calls.append(len(messages))
        # First pass: not JSON. Second pass (repair): valid JSON.
        return "not json" if len(calls) == 1 else '{"scores": {"a": 0.4, "b": 0.6}}'

    reranker = OpenAICompatibleReranker(
        api_key="k", base_url="https://x", model="m", complete=complete
    )
    result = reranker.rerank(
        RerankRequest(
            question="q",
            candidates=[
                RerankCandidate(id="a", title="", text="t1"),
                RerankCandidate(id="b", title="", text="t2"),
            ],
        )
    )
    # Two asks: the original + one repair.
    assert len(calls) == 2
    assert result.scores == {"a": 0.4, "b": 0.6}


def test_openai_compatible_hard_fails_after_second_bad_json() -> None:
    def complete(_: list[dict[str, str]]) -> str:
        return "still not json"

    reranker = OpenAICompatibleReranker(
        api_key="k", base_url="https://x", model="m", complete=complete
    )
    with pytest.raises(RerankError, match="valid rerank scores"):
        reranker.rerank(
            RerankRequest(
                question="q",
                candidates=[
                    RerankCandidate(id="a", title="", text="t1"),
                    RerankCandidate(id="b", title="", text="t2"),
                ],
            )
        )


def test_openai_compatible_network_error_becomes_rerank_error() -> None:
    def complete(_: list[dict[str, str]]) -> str:
        raise error.URLError("connection refused")

    reranker = OpenAICompatibleReranker(
        api_key="k", base_url="https://x", model="m", complete=complete
    )
    with pytest.raises(RerankError, match="could not be reached"):
        reranker.rerank(
            RerankRequest(
                question="q",
                candidates=[
                    RerankCandidate(id="a", title="", text="t1"),
                    RerankCandidate(id="b", title="", text="t2"),
                ],
            )
        )


# --- to_rerank_result validation --------------------------------------------


def test_to_rerank_result_drops_unknown_ids() -> None:
    from backend.assistant.reranker import _WrittenRerank

    written = _WrittenRerank(scores={"a": 0.5, "ghost": 0.9})
    result = to_rerank_result(written, {"a", "b"})
    assert result.scores == {"a": 0.5}


def test_to_rerank_result_clamps_to_unit_interval() -> None:
    from backend.assistant.reranker import _WrittenRerank

    written = _WrittenRerank(scores={"a": -0.3, "b": 1.7})
    result = to_rerank_result(written, {"a", "b"})
    assert result.scores == {"a": 0.0, "b": 1.0}


# --- settings ---------------------------------------------------------------


def test_disabled_by_default_even_when_assistant_is_on(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Rerank is additive and off by default; `ASSISTANT_API_KEY` alone is not enough."""
    monkeypatch.setenv("ASSISTANT_API_KEY", "sk-assistant")
    monkeypatch.delenv("ASSISTANT_RERANK_ENABLED", raising=False)
    settings = AssistantSettings(_env_file=None)  # type: ignore[call-arg]
    assert settings.enabled is True
    assert settings.rerank_enabled is False
    assert get_reranker(settings) is None


def test_get_reranker_uses_assistant_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ASSISTANT_API_KEY", "sk-assistant")
    monkeypatch.setenv("ASSISTANT_CHAT_MODEL", "openai/gpt-4o-mini")
    monkeypatch.setenv("ASSISTANT_RERANK_ENABLED", "1")
    settings = AssistantSettings(_env_file=None)  # type: ignore[call-arg]
    reranker = get_reranker(settings)
    assert isinstance(reranker, OpenAICompatibleReranker)


def test_rerank_model_overrides_chat_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ASSISTANT_API_KEY", "sk-assistant")
    monkeypatch.setenv("ASSISTANT_CHAT_MODEL", "openai/gpt-4o-mini")
    monkeypatch.setenv("ASSISTANT_RERANK_MODEL", "openai/gpt-4o")
    monkeypatch.setenv("ASSISTANT_RERANK_ENABLED", "1")
    settings = AssistantSettings(_env_file=None)  # type: ignore[call-arg]
    reranker = get_reranker(settings)
    assert isinstance(reranker, OpenAICompatibleReranker)
    assert reranker._model == "openai/gpt-4o"  # type: ignore[attr-defined]
