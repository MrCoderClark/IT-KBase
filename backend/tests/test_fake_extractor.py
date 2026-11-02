"""FakeExtractor is the deterministic pipeline stand-in (spec 05 §7)."""

from __future__ import annotations

from backend.extractors import FakeExtractor, KBExtractor
from backend.parse.models import ParsedDraft, ParsedStep


def test_fake_extractor_satisfies_protocol() -> None:
    extractor: KBExtractor = FakeExtractor()
    draft = ParsedDraft(
        title="Reset local admin password",
        overview="Use lusrmgr.msc on the console.\n\nConfirm the account unlocks.",
        steps=[
            ParsedStep(
                title="Open Local Users and Groups",
                body="Run lusrmgr.msc.",
                images=["data:image/png;base64,AAAA"],
            )
        ],
    )

    out = extractor.structure(draft)

    assert out.title == "Reset local admin password"
    assert out.summary == "Use lusrmgr.msc on the console."
    assert out.steps[0].images == ["data:image/png;base64,AAAA"]
    assert out.overview == draft.overview


def test_fake_extractor_keeps_an_existing_summary() -> None:
    draft = ParsedDraft(
        title="BitLocker recovery",
        summary="Recover a BitLocker volume with the 48-digit key.",
        overview="Open manage-bde and supply the recovery key.",
    )

    out = FakeExtractor().structure(draft)

    assert out.summary == "Recover a BitLocker volume with the 48-digit key."
