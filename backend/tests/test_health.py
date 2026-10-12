"""Smoke tests for liveness and readiness endpoints.

These are the first tests to run on any PR; a red test here means the
service won't even come up, so CI should bail fast.
"""

from __future__ import annotations

from datetime import datetime

from fastapi.testclient import TestClient


def test_healthz_returns_ok(client: TestClient) -> None:
    r = client.get("/healthz")
    assert r.status_code == 200

    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "techbase-ingestion"
    assert body["version"] == "0.1.0"
    assert body["env"] in {"local", "preview", "staging", "prod"}

    # time is ISO 8601 and parseable
    datetime.fromisoformat(body["time"])


def test_readyz_returns_ready(client: TestClient) -> None:
    r = client.get("/readyz")
    assert r.status_code == 200
    assert r.json()["status"] == "ready"


def test_openapi_exposes_both_endpoints(client: TestClient) -> None:
    """Guard against accidentally removing a documented route."""
    r = client.get("/openapi.json")
    assert r.status_code == 200

    paths = r.json()["paths"]
    assert "/healthz" in paths
    assert "/readyz" in paths


def test_docs_are_exposed_in_default_config(client: TestClient) -> None:
    r = client.get("/docs")
    assert r.status_code == 200
