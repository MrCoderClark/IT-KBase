"""Post-extract validation and low-confidence fallback."""

from __future__ import annotations

from backend.parse.models import ParsedCallout, ParsedDraft, ParsedStep
from backend.parse.validate import check_draft, soft_fix, validate_draft


def test_soft_fix_clips_title_and_drops_empty_steps() -> None:
    draft = ParsedDraft(
        title="T" * 200,
        overview="Body.",
        steps=[
            ParsedStep(title="", body="", code=""),
            ParsedStep(title="Open console", body="Run lusrmgr.msc."),
        ],
        troubleshooting=[
            ParsedCallout.model_construct(title="Tip", body="Retry.", variant="nope"),
        ],
    )
    fixed, warnings = soft_fix(draft)
    assert len(fixed.title) == 160
    assert len(fixed.steps) == 1
    assert fixed.troubleshooting[0].variant is None
    assert warnings


def test_validate_falls_back_to_parser_draft() -> None:
    parser = ParsedDraft(
        title="Reset local admin password",
        overview="Use the console.",
        steps=[ParsedStep(title="Open lusrmgr", body="Run it.")],
        ingestSegments=[
            {
                "title": "Procedure",
                "headingLevel": 1,
                "candidateKind": "steps",
                "blocks": [{"type": "text", "text": "1. Open lusrmgr\n2. Reset"}],
            }
        ],
    )
    # Structured draft fails: no title, no body
    bad = ParsedDraft(title="", overview="", steps=[])
    result = validate_draft(bad, parser_draft=parser)
    assert result.low_confidence is True
    assert result.draft.lowConfidence is True
    assert result.draft.title == "Reset local admin password"
    assert "Procedure" in result.draft.overview
    assert result.draft.steps[0].title == "Open lusrmgr"


def test_check_draft_requires_content() -> None:
    errors = check_draft(ParsedDraft(title="Only title"))
    assert any("section" in error.casefold() for error in errors)
