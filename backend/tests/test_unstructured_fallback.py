"""Unstructured fallback when the primary DOCX/PDF parsers fail."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from backend.api.parse import iter_draft_from_bytes
from backend.parse.docx import DocxError
from backend.parse.models import ParsedDraft
from backend.parse.unstructured_fallback import (
    UnstructuredError,
    elements_to_lines,
    parse_unstructured,
)
from backend.progress import ProgressEvent


def test_elements_to_lines_maps_titles_lists_and_body() -> None:
    elements = [
        SimpleNamespace(text="Reset local admin", category="Title"),
        SimpleNamespace(text="Overview body here.", category="NarrativeText"),
        SimpleNamespace(text="1. Open lusrmgr.msc", category="ListItem"),
        SimpleNamespace(text="Confirm the account.", category="NarrativeText"),
    ]
    lines = elements_to_lines(elements)
    assert lines[0].heading is True
    assert lines[0].text == "Reset local admin"
    assert lines[1].heading is False
    assert lines[2].list_item is True
    assert lines[2].numbered is True


def test_parse_unstructured_sets_low_fidelity(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_partition(**_kwargs):
        return [
            SimpleNamespace(text="Reset local admin", category="Title"),
            SimpleNamespace(text="Use Computer Management.", category="NarrativeText"),
            SimpleNamespace(text="1. Open lusrmgr.msc", category="ListItem"),
            SimpleNamespace(text="2. Reset the password", category="ListItem"),
        ]

    draft = parse_unstructured(b"fake-bytes", "broken.docx", partition_fn=fake_partition)
    assert draft.lowFidelitySource is True
    assert draft.title
    assert any("Low-fidelity" in note for note in draft.validationWarnings)
    assert "low-fidelity" in draft.readingNotes.casefold()


def test_parse_unstructured_empty_raises() -> None:
    with pytest.raises(UnstructuredError, match="no text"):
        parse_unstructured(b"x", "empty.docx", partition_fn=lambda **_: [])


def test_iter_draft_falls_back_when_docx_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(_data: bytes, _name: str) -> ParsedDraft:
        raise DocxError("That file is not a Word document.")

    def fake_partition(**_kwargs):
        return [
            SimpleNamespace(text="Scan to share", category="Title"),
            SimpleNamespace(text="Copy the file to the share.", category="NarrativeText"),
            SimpleNamespace(text="1. Map the drive", category="ListItem"),
        ]

    monkeypatch.setattr("backend.api.parse.parse_docx", boom)
    monkeypatch.setattr(
        "backend.api.parse.parse_unstructured",
        lambda data, name: parse_unstructured(data, name, partition_fn=fake_partition),
    )
    monkeypatch.setattr(
        "backend.api.parse.get_extractor",
        lambda: _PassthroughExtractor(),
    )
    monkeypatch.setattr("backend.api.parse.write_artifact_bundle", lambda *_a, **_k: None)
    monkeypatch.setattr("backend.api.parse.build_bundle", lambda **_k: object())

    # PK zip magic so the DOCX branch is chosen.
    data = b"PK\x03\x04" + b"0" * 40
    events = list(
        iter_draft_from_bytes(
            data,
            "broken.docx",
            job_id="job-fallback",
            persist_artifact=False,
        )
    )
    progress = [item for item in events if isinstance(item, ProgressEvent)]
    draft = next(item for item in events if isinstance(item, ParsedDraft))
    parse_done = next(
        item for item in progress if item.stage == "parsing" and item.status == "succeeded"
    )
    assert "low fidelity" in parse_done.detail
    assert draft.lowFidelitySource is True
    assert any("Low-fidelity" in note for note in draft.validationWarnings)


class _PassthroughExtractor:
    last_llm = None

    def structure(self, draft: ParsedDraft) -> ParsedDraft:
        return draft
