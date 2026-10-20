"""An empty Overview is written from the extracted steps. A real one is kept."""

from __future__ import annotations

from backend.parse.models import ParsedDraft, ParsedStep
from backend.parse.overview import fill_overview


def _procedure() -> ParsedDraft:
    return ParsedDraft(
        title="Access Onet client files",
        steps=[
            ParsedStep(
                title="Log into Microsoft OneDrive",
                body="Use the company account.",
                images=["data:image/png;base64,AAAA"],
            ),
            ParsedStep(title="Open the recycle bin on the left"),
        ],
    )


def test_empty_overview_is_written_from_the_steps() -> None:
    seen: list[str] = []

    def complete(source: str) -> str:
        seen.append(source)
        return (
            '{"summary": "Restore a file deleted from a synced OneDrive folder.",'
            ' "overview": "Sign in to OneDrive and restore the deleted file from the recycle bin.",'
            ' "verification": ["The file is back in the original folder."],'
            ' "troubleshooting": [{"title": "Restore does nothing",'
            ' "body": "Select the file in the recycle bin, then click Restore again."}]}'
        )

    filled = fill_overview(
        _procedure(),
        api_key="test",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        complete=complete,
    )

    assert "recycle bin" in filled.overview
    assert filled.summary.startswith("Restore")
    assert filled.verification == ["The file is back in the original folder."]
    assert filled.troubleshooting[0].title == "Restore does nothing"
    assert "data:image" not in seen[0]
    assert "Log into Microsoft OneDrive" in seen[0]


def test_an_overview_already_in_the_file_is_kept() -> None:
    draft = _procedure().model_copy(update={"overview": "Already written."})

    filled = fill_overview(
        draft,
        api_key="test",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        complete=lambda _source: (
            '{"overview": "Replacement.",'
            ' "verification": ["The restored file is in the original folder."],'
            ' "troubleshooting": [{"title": "File still missing",'
            ' "body": "Confirm the recycle bin still lists the file before restoring."}]}'
        ),
    )

    assert filled.overview == "Already written."
    assert filled.verification == ["The restored file is in the original folder."]
    assert filled.troubleshooting[0].title == "File still missing"


def test_filled_sections_skip_the_model() -> None:
    draft = _procedure().model_copy(
        update={
            "overview": "Already written.",
            "verification": ["Already checked."],
            "troubleshooting": [{"title": "Already listed", "body": "Do the documented fix."}],
        }
    )

    filled = fill_overview(
        draft,
        api_key="test",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        complete=lambda _source: "should not be called",
    )

    assert filled.overview == "Already written."
    assert filled.verification == ["Already checked."]


def test_a_bad_model_response_leaves_the_steps() -> None:
    draft = _procedure()

    filled = fill_overview(
        draft,
        api_key="test",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        complete=lambda _source: "not json",
    )

    assert filled.overview == ""
    assert filled.steps[0].title == "Log into Microsoft OneDrive"


def test_missing_api_key_skips_the_model() -> None:
    filled = fill_overview(
        _procedure(),
        api_key="",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        complete=lambda _source: "should not be called",
    )

    assert filled.overview == ""
