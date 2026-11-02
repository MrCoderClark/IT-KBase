"""Deterministic extractor for pipeline tests — no network, no LLM."""

from __future__ import annotations

from backend.parse.models import ParsedDraft


class FakeExtractor:
    """Copy parser sections into a stable draft shape.

    Fills a missing summary from the overview first sentence. Leaves every
    other section as the parser produced it (including step images).
    """

    def structure(self, draft: ParsedDraft) -> ParsedDraft:
        summary = draft.summary.strip()
        if not summary and draft.overview.strip():
            first = draft.overview.strip().split("\n", 1)[0].strip()
            summary = first[:240]
        return draft.model_copy(
            update={
                "title": draft.title.strip() or "Untitled",
                "summary": summary,
            }
        )
