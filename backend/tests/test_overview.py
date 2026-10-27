"""The model structures extracted text. It does not invent a missing section."""

from __future__ import annotations

from backend.parse.models import ParsedDraft, ParsedStep
from backend.parse.overview import structure_draft


def _procedure() -> ParsedDraft:
    return ParsedDraft(
        title="Access Onet client files",
        overview="Sign in.\n\nOpen the recycle bin.",
        steps=[
            ParsedStep(
                title="Log into Microsoft OneDrive",
                body="Use the company account.",
                images=["data:image/png;base64,AAAA"],
            ),
            ParsedStep(title="Open the recycle bin on the left"),
        ],
    )


def test_the_model_structures_the_extracted_body() -> None:
    seen: list[str] = []

    def complete(message: str) -> str:
        seen.append(message)
        return (
            '{"summary": "Restore a file deleted from a synced OneDrive folder.",'
            ' "overview": "Sign in to OneDrive and restore the deleted file from the recycle bin.",'
            ' "steps": [{"title": "Log into Microsoft OneDrive", "body": "Use the company account.", "code": ""},'
            ' {"title": "Open the recycle bin on the left", "body": "", "code": ""}],'
            ' "verification": [],'
            ' "troubleshooting": []}'
        )

    filled = structure_draft(
        _procedure(),
        api_key="test",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        complete=complete,
    )

    assert "recycle bin" in filled.overview
    assert filled.summary.startswith("Restore")
    assert filled.verification == []
    assert filled.troubleshooting == []
    assert filled.steps[0].images == ["data:image/png;base64,AAAA"]
    assert "data:image" not in seen[0]
    assert "Open the recycle bin." in seen[0]


def test_an_empty_model_section_keeps_the_extracted_one() -> None:
    draft = _procedure().model_copy(update={"overview": "Already written."})

    filled = structure_draft(
        draft,
        api_key="test",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        complete=lambda _message: '{"verification": ["The restored file is in the original folder."]}',
    )

    assert filled.overview == "Already written."
    assert filled.verification == ["The restored file is in the original folder."]
    assert filled.steps[0].title == "Log into Microsoft OneDrive"


def test_invalid_json_is_repaired_once() -> None:
    calls: list[str] = []

    def complete(message: str) -> str:
        calls.append(message)
        if len(calls) == 1:
            return '{"verification": "not-a-list"}'
        return '{"overview": "County referrals are entered as leads.", "verification": [], "troubleshooting": []}'

    filled = structure_draft(
        ParsedDraft(title="WFNJ Flow Process", overview="BCBSS faxes referrals.\n\nF1\n\nEnter the lead."),
        api_key="test",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        complete=complete,
    )

    assert len(calls) == 2
    assert "validation" in calls[1].casefold()
    assert filled.overview == "County referrals are entered as leads."
    assert filled.verification == []
    assert filled.troubleshooting == []


def test_a_second_invalid_response_leaves_the_parser_draft() -> None:
    filled = structure_draft(
        _procedure(),
        api_key="test",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        complete=lambda _message: "not json",
    )

    assert filled.overview == "Sign in.\n\nOpen the recycle bin."
    assert filled.steps[0].title == "Log into Microsoft OneDrive"


def test_missing_api_key_skips_the_model() -> None:
    filled = structure_draft(
        _procedure(),
        api_key="",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        complete=lambda _message: "should not be called",
    )

    assert filled.overview == "Sign in.\n\nOpen the recycle bin."
