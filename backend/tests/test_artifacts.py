"""Artifact bundle shape, key layout, and offline write/load."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from backend.artifacts import (
    artifact_json_key,
    build_bundle,
    find_artifact_key,
    load_artifact,
    segments_from_draft,
    source_object_key,
    write_artifact_bundle,
)
from backend.extractors import FakeExtractor
from backend.parse.models import ParsedDraft, ParsedStep
from backend.storage import StorageError


def _draft() -> ParsedDraft:
    return ParsedDraft(
        title="Reset local admin password",
        overview="Use lusrmgr.msc on the console.",
        steps=[ParsedStep(title="Open Local Users and Groups", body="Run lusrmgr.msc.")],
    )


def test_artifact_keys_use_year_month_job() -> None:
    when = datetime(2026, 11, 2, tzinfo=UTC)
    assert artifact_json_key("job-abc", when) == "uploads/2026/11/job-abc/artifact.json"
    assert source_object_key("job-abc", "runbook.docx", when) == "uploads/2026/11/job-abc/source.docx"
    assert source_object_key("job-abc", "guide.PDF", when) == "uploads/2026/11/job-abc/source.pdf"


def test_segments_follow_parser_sections() -> None:
    segments = segments_from_draft(_draft())
    kinds = [row["kind"] for row in segments]
    assert kinds == ["overview", "steps"]


def test_write_and_load_artifact_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    store: dict[str, bytes] = {}

    def put(key: str, data: bytes, content_type: str, *, expires_in_days: int | None = None) -> None:
        assert expires_in_days == 7
        store[key] = data

    def exists(key: str) -> bool:
        return key in store

    def download(key: str) -> bytes:
        if key not in store:
            raise StorageError("That file is not in storage.")
        return store[key]

    monkeypatch.setattr("backend.artifacts.put_object", put)
    monkeypatch.setattr("backend.artifacts.object_exists", exists)
    monkeypatch.setattr("backend.artifacts.download_object", download)

    data = b"PK\x03\x04fake-docx"
    draft = _draft()
    structured = FakeExtractor().structure(draft)
    when = datetime(2026, 11, 2, 12, 0, tzinfo=UTC)
    bundle = build_bundle(
        job_id="job1",
        file_name="runbook.docx",
        data=data,
        parser_draft=draft,
        draft_proto=structured,
        final_draft=structured,
        timings=[{"stage": "parsing", "durationMs": 12}],
        llm=None,
        source_key="uploads/user1/abc/runbook.docx",
        when=when,
    )
    key = write_artifact_bundle(bundle, data)
    assert key == "uploads/2026/11/job1/artifact.json"
    assert "uploads/2026/11/job1/source.docx" in store

    loaded, raw = load_artifact("job1")
    assert loaded.jobId == "job1"
    assert loaded.draft["title"] == "Reset local admin password"
    assert loaded.rawDoc["sha256"]
    assert raw == data
    assert find_artifact_key("job1") == key


def test_missing_artifact_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.artifacts.object_exists", lambda _key: False)
    with pytest.raises(StorageError, match="No artifact"):
        find_artifact_key("missing-job")
