"""Compatibility shim — prefer `backend.extractors.OpenAICompatibleExtractor`.

Kept so older imports of `structure_draft` keep working during the cutover.
"""

from __future__ import annotations

from collections.abc import Callable

from backend.extractors.openai_compatible import OpenAICompatibleExtractor
from backend.parse.models import ParsedDraft


def structure_draft(
    draft: ParsedDraft,
    *,
    api_key: str,
    model: str,
    base_url: str,
    complete: Callable[[str], str] | None = None,
) -> ParsedDraft:
    return OpenAICompatibleExtractor(
        api_key=api_key,
        model=model,
        base_url=base_url,
        complete=complete,
    ).structure(draft)
