"""POST /assistant/embed and the embedder. No test calls a real provider."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from urllib import error

import pytest
from fastapi.testclient import TestClient

from auth_py.assertion import AssertionClaims, mint_assertion
from backend.app import create_app
from backend.assistant.embeddings import (
    EmbeddingError,
    Embeddings,
    FakeEmbedder,
    OpenAICompatibleEmbedder,
    get_embedder,
)
from backend.config import AssistantSettings, get_settings

NOW = datetime(2026, 11, 2, 16, 0, tzinfo=UTC)
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
    # Embedding has nothing to do with object storage. Keep this unit test off
    # the local S3 path so the lifespan doesn't make a SeaweedFS CORS round-trip
    # per test (slow, and hangs the suite when SeaweedFS is down).
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


def _use(monkeypatch: pytest.MonkeyPatch, embedder: Any) -> None:
    monkeypatch.setattr("backend.api.assistant.get_embedder", lambda: embedder)


# --- endpoint ---------------------------------------------------------------


def test_reader_gets_one_vector_per_input(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, FakeEmbedder())
    response = api.post(
        "/assistant/embed",
        json={"inputs": ["Reset the local admin password", "Autopilot error 0x80180014"]},
        headers=_user(monkeypatch, "reader"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "fake-embedding"
    assert body["dimensions"] == 1536
    assert len(body["embeddings"]) == 2
    assert all(len(vector) == 1536 for vector in body["embeddings"])
    assert body["embeddings"][0] != body["embeddings"][1]


def test_same_text_gives_same_vector(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, FakeEmbedder())
    headers = _user(monkeypatch)
    first = api.post("/assistant/embed", json={"inputs": ["VPN drops"]}, headers=headers).json()
    second = api.post("/assistant/embed", json={"inputs": ["VPN drops"]}, headers=headers).json()
    assert first["embeddings"] == second["embeddings"]


def test_worker_service_token_is_allowed(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, FakeEmbedder())
    response = api.post(
        "/assistant/embed",
        json={"inputs": ["chunk text"]},
        headers={"Authorization": f"Bearer {SERVICE_TOKEN}"},
    )
    assert response.status_code == 200


def test_requires_a_caller(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, FakeEmbedder())
    response = api.post("/assistant/embed", json={"inputs": ["x"]})
    assert response.status_code == 401


def test_not_configured_is_503(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, None)
    response = api.post("/assistant/embed", json={"inputs": ["x"]}, headers=_user(monkeypatch))
    assert response.status_code == 503
    assert response.json()["detail"] == "The AI Assistant is not configured."


def test_provider_failure_is_502(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    class Broken:
        model = "broken"
        dimensions = 1536

        def embed(self, texts: list[str]) -> Embeddings:
            raise EmbeddingError("Embedding provider returned HTTP 402.")

    _use(monkeypatch, Broken())
    response = api.post("/assistant/embed", json={"inputs": ["x"]}, headers=_user(monkeypatch))
    assert response.status_code == 502
    assert response.json()["detail"] == "Embedding provider returned HTTP 402."


@pytest.mark.parametrize(
    "payload",
    [
        {"inputs": []},
        {"inputs": [""]},
        {"inputs": ["x"] * 65},
        {"inputs": ["x" * 8001]},
    ],
)
def test_rejects_bad_input(
    api: TestClient, monkeypatch: pytest.MonkeyPatch, payload: dict[str, Any]
) -> None:
    _use(monkeypatch, FakeEmbedder())
    response = api.post("/assistant/embed", json=payload, headers=_user(monkeypatch))
    assert response.status_code == 422


# --- embedder ---------------------------------------------------------------


def _vector(n: int, value: float = 0.1) -> list[float]:
    return [value] * n


def test_openai_compatible_sends_model_and_dimensions_and_orders_by_index() -> None:
    seen: dict[str, Any] = {}

    def post(url: str, headers: dict[str, str], payload: dict[str, Any]) -> Any:
        seen.update(url=url, headers=headers, payload=payload)
        return {
            "data": [
                {"index": 1, "embedding": _vector(4, 0.2)},
                {"index": 0, "embedding": _vector(4, 0.1)},
            ],
            "usage": {"prompt_tokens": 7},
        }

    embedder = OpenAICompatibleEmbedder(
        api_key="sk-test",
        base_url="https://openrouter.ai/api/v1/",
        model="openai/text-embedding-3-small",
        dimensions=4,
        post=post,
    )
    result = embedder.embed(["first", "second"])

    assert seen["url"] == "https://openrouter.ai/api/v1/embeddings"
    assert seen["headers"]["Authorization"] == "Bearer sk-test"
    assert seen["payload"] == {
        "model": "openai/text-embedding-3-small",
        "input": ["first", "second"],
        "dimensions": 4,
        "encoding_format": "float",
    }
    assert result.vectors == [_vector(4, 0.1), _vector(4, 0.2)]
    assert result.prompt_tokens == 7


def test_wrong_vector_size_is_rejected() -> None:
    embedder = OpenAICompatibleEmbedder(
        api_key="k",
        base_url="https://x",
        model="m",
        dimensions=1536,
        post=lambda *_: {"data": [{"index": 0, "embedding": _vector(536)}]},
    )
    with pytest.raises(EmbeddingError, match="wrong size"):
        embedder.embed(["text"])


def test_wrong_vector_count_is_rejected() -> None:
    embedder = OpenAICompatibleEmbedder(
        api_key="k",
        base_url="https://x",
        model="m",
        dimensions=4,
        post=lambda *_: {"data": [{"index": 0, "embedding": _vector(4)}]},
    )
    with pytest.raises(EmbeddingError, match="number of vectors"):
        embedder.embed(["one", "two"])


def test_http_error_message_never_contains_the_key() -> None:
    def post(url: str, headers: dict[str, str], payload: dict[str, Any]) -> Any:
        raise error.HTTPError(url, 401, "Unauthorized", hdrs=None, fp=None)  # type: ignore[arg-type]

    embedder = OpenAICompatibleEmbedder(
        api_key="sk-secret-value", base_url="https://x", model="m", dimensions=4, post=post
    )
    with pytest.raises(EmbeddingError) as caught:
        embedder.embed(["text"])
    assert "401" in str(caught.value)
    assert "sk-secret-value" not in str(caught.value)


def test_network_error_becomes_embedding_error() -> None:
    def post(*_: Any) -> Any:
        raise error.URLError("connection refused")

    embedder = OpenAICompatibleEmbedder(api_key="k", base_url="https://x", model="m", dimensions=4, post=post)
    with pytest.raises(EmbeddingError, match="could not be reached"):
        embedder.embed(["text"])


def test_assistant_ignores_ingestion_ai_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    """ASSISTANT_* and AI_* are independent: an ingestion key never turns the assistant on."""
    monkeypatch.setenv("AI_API_KEY", "sk-ingestion-only")
    monkeypatch.delenv("ASSISTANT_API_KEY", raising=False)
    settings = AssistantSettings(_env_file=None)  # type: ignore[call-arg]
    assert settings.enabled is False
    assert get_embedder(settings) is None


def test_get_embedder_uses_assistant_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ASSISTANT_API_KEY", "sk-assistant")
    monkeypatch.setenv("ASSISTANT_EMBEDDING_MODEL", "openai/text-embedding-3-small")
    settings = AssistantSettings(_env_file=None)  # type: ignore[call-arg]
    embedder = get_embedder(settings)
    assert isinstance(embedder, OpenAICompatibleEmbedder)
    assert embedder.model == "openai/text-embedding-3-small"
    assert embedder.dimensions == 1536
