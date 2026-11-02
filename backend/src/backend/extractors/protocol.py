"""Pluggable LLM structure step (spec 05 §3.4).

The parser draft remains the working shape (`ParsedDraft` ≈ DraftProto).
Candidate segments travel on `draft.ingestSegments` (excluded from API JSON).
"""

from __future__ import annotations

from typing import Protocol

from backend.parse.models import ParsedDraft


class KBExtractor(Protocol):
    def structure(self, draft: ParsedDraft) -> ParsedDraft:
        """Return a structured article draft from parser output + segments."""
        ...
