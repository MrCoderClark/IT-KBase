"""Shared pytest fixtures for the backend test suite."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    """A fresh TestClient per test, backed by a new app factory call.

    Using the factory (not the module-level `app`) keeps lifespan events
    isolated between tests and avoids leaking configure_logging across
    the suite.
    """
    with TestClient(create_app()) as c:
        yield c
