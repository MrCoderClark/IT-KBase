"""Pluggable LLM structure step (spec 05 §3.4).

NormDoc / Segment land when the fuller segmenter ships. Until then the parser
draft is the input and output shape (`ParsedDraft` ≈ DraftProto).
"""

from __future__ import annotations

from typing import Protocol

from backend.parse.models import ParsedDraft


class KBExtractor(Protocol):
    def structure(self, draft: ParsedDraft) -> ParsedDraft:
        """Return a structured article draft from parser output."""
        ...
