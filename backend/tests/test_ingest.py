"""A stored file becomes a draft. The test never talks to object storage."""

from __future__ import annotations

from datetime import UTC, datetime
from io import BytesIO

import pytest
from docx import Document
from fastapi.testclient import TestClient

from auth_py.assertion import AssertionClaims, mint_assertion
from backend.app import create_app
from backend.config import get_settings

NOW = datetime(2026, 10, 14, 16, 0, tzinfo=UTC)
SECRET = b"test-assertion-key"


class _EmptyAi:
    api_key = ""
    model = ""
    base_url = ""


class _FrozenClock:
    @staticmethod
    def now(_tz=None):
        return NOW


@pytest.fixture
def authed(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("TB_ASSERTION_KEYS", "k1:test-assertion-key")
    monkeypatch.setenv("TB_SERVICE_TOKENS", "")
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        yield client
    get_settings.cache_clear()


def _headers(monkeypatch: pytest.MonkeyPatch, role: str = "author", uid: str = "user1") -> dict[str, str]:
    monkeypatch.setattr("auth_py.dependency.datetime", _FrozenClock)
    token = mint_assertion(
        AssertionClaims(
            aud="ingestion",
            exp=int(NOW.timestamp()) + 60,
            gen=3,
            iat=int(NOW.timestamp()),
            kid="k1",
            role=role,
            sub="id1",
            uid=uid,
        ),
        SECRET,
    )
    return {"Authorization": f"Bearer {token}"}


def _docx() -> bytes:
    document = Document()
    document.core_properties.title = "Stored Runbook"
    document.add_paragraph("Reset the local administrator password.")
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def test_ingest_requires_a_bearer_token(authed: TestClient) -> None:
    response = authed.post(
        "/ingest",
        json={
            "jobId": "job1",
            "s3Key": "uploads/user1/abc/runbook.docx",
            "fileName": "runbook.docx",
            "sourceKind": "docx",
            "sizeBytes": 12,
        },
    )
    assert response.status_code == 401


def test_a_reader_cannot_import(authed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    response = authed.post(
        "/ingest",
        headers=_headers(monkeypatch, role="reader"),
        json={
            "jobId": "job1",
            "s3Key": "uploads/user1/abc/runbook.docx",
            "fileName": "runbook.docx",
            "sourceKind": "docx",
            "sizeBytes": 12,
        },
    )
    assert response.status_code == 403


def test_ingest_refuses_another_users_key(authed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    called: list[str] = []
    monkeypatch.setattr("backend.api.ingest.download_object", lambda key: called.append(key))
    response = authed.post(
        "/ingest",
        headers=_headers(monkeypatch),
        json={
            "jobId": "job1",
            "s3Key": "uploads/other/abc/runbook.docx",
            "fileName": "runbook.docx",
            "sourceKind": "docx",
            "sizeBytes": 12,
        },
    )
    assert response.status_code == 422
    assert called == []


def test_ingest_reads_the_stored_docx(authed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    data = _docx()
    monkeypatch.setattr("backend.api.ingest.download_object", lambda _key: data)
    monkeypatch.setattr("backend.api.parse.get_ai_settings", lambda: _EmptyAi())
    response = authed.post(
        "/ingest",
        headers=_headers(monkeypatch),
        json={
            "jobId": "job1",
            "s3Key": "uploads/user1/abc/runbook.docx",
            "fileName": "runbook.docx",
            "sourceKind": "docx",
            "sizeBytes": len(data),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["jobId"] == "job1"
    assert body["draft"]["title"] == "Stored Runbook"


def test_ingest_stream_emits_stage_events(authed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    data = _docx()
    monkeypatch.setattr("backend.api.ingest.download_object", lambda _key: data)
    monkeypatch.setattr("backend.api.parse.get_ai_settings", lambda: _EmptyAi())
    response = authed.post(
        "/ingest",
        headers={**_headers(monkeypatch), "Accept": "text/event-stream"},
        json={
            "jobId": "job1",
            "s3Key": "uploads/user1/abc/runbook.docx",
            "fileName": "runbook.docx",
            "sourceKind": "docx",
            "sizeBytes": len(data),
        },
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    body = response.text
    assert "event: progress" in body
    assert '"stage": "parsing"' in body
    assert '"stage": "extracting"' in body
    assert "event: done" in body
    assert "Stored Runbook" in body


def test_presign_returns_a_put_url(authed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "backend.api.ingest.presign_put",
        lambda key, content_type: (f"http://store/{key}", {"Content-Type": content_type}),
    )
    response = authed.post(
        "/v1/uploads/presign",
        headers=_headers(monkeypatch),
        json={
            "fileName": "runbook.docx",
            "contentType": "application/octet-stream",
            "sizeBytes": 1200,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["key"].startswith("uploads/user1/")
    assert body["key"].endswith("runbook.docx")
    assert body["url"].startswith("http://store/uploads/user1/")
    assert body["headers"]["Content-Type"].startswith("application/vnd.openxmlformats")
