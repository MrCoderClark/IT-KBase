"""The ingestion API rejects callers who lack a 60-second assertion."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from auth_py.assertion import AssertionClaims, mint_assertion
from backend.app import create_app
from backend.config import get_settings

NOW = datetime(2026, 10, 14, 16, 0, tzinfo=UTC)
SECRET = b"test-assertion-key"


@pytest.fixture
def authed_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("TB_ASSERTION_KEYS", "k1:test-assertion-key")
    monkeypatch.setenv("TB_SERVICE_TOKENS", "sv_test-job")
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        yield client
    get_settings.cache_clear()


def test_health_stays_open(authed_client: TestClient) -> None:
    response = authed_client.get("/healthz")
    assert response.status_code == 200


def test_principal_requires_a_bearer_token(authed_client: TestClient) -> None:
    response = authed_client.get("/v1/principal")
    assert response.status_code == 401


# Minted by auth/web with key k1:test-assertion-key at 2026-10-14T16:00:00Z.
TS_TOKEN = (
    "v1.eyJhdWQiOiJpbmdlc3Rpb24iLCJleHAiOjE3OTE5OTM2NjAsImdlbiI6MywiaWF0IjoxNzkxOTkzNjAw"
    "LCJraWQiOiJrMSIsInJvbGUiOiJhdXRob3IiLCJzdWIiOiJpZDEiLCJ1aWQiOiJ1c2VyMSJ9"
    ".bI17eGuRZ_gktxkrwToOjA6aCNksSj2b-8QxIICkkro"
)


def test_principal_accepts_a_token_minted_by_typescript(
    authed_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("auth_py.dependency.datetime", _FrozenClock)
    response = authed_client.get("/v1/principal", headers={"Authorization": f"Bearer {TS_TOKEN}"})
    assert response.status_code == 200
    assert response.json() == {"kind": "user", "user_id": "user1", "role": "author"}


def test_principal_accepts_a_signed_assertion(authed_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("auth_py.dependency.datetime", _FrozenClock)
    token = mint_assertion(
        AssertionClaims(
            aud="ingestion",
            exp=int(NOW.timestamp()) + 60,
            gen=3,
            iat=int(NOW.timestamp()),
            kid="k1",
            role="author",
            sub="id1",
            uid="user1",
        ),
        SECRET,
    )
    response = authed_client.get("/v1/principal", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {"kind": "user", "user_id": "user1", "role": "author"}


def test_principal_rejects_a_bad_signature(authed_client: TestClient) -> None:
    response = authed_client.get("/v1/principal", headers={"Authorization": "Bearer v1.aaaa.bbbb"})
    assert response.status_code == 401


def test_principal_accepts_a_service_credential(authed_client: TestClient) -> None:
    response = authed_client.get("/v1/principal", headers={"Authorization": "Bearer sv_test-job"})
    assert response.status_code == 200
    assert response.json()["kind"] == "service"


def test_principal_rejects_an_unknown_service_credential(authed_client: TestClient) -> None:
    response = authed_client.get("/v1/principal", headers={"Authorization": "Bearer sv_other"})
    assert response.status_code == 401


class _FrozenClock:
    @staticmethod
    def now(_tz=None):
        return NOW
