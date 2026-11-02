"""Segmenter turns headings into candidate section kinds for the LLM."""

from __future__ import annotations

from io import BytesIO

from docx import Document

from backend.parse.docx import _Line, parse_docx
from backend.parse.segments import candidate_kind, section_kind, segment_lines


def _bytes(document: Document) -> bytes:
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def test_section_kind_ignores_step_inside_a_sentence() -> None:
    assert section_kind("Prerequisites") == "prerequisites"
    assert section_kind("Step-by-Step Instructions") == "steps"
    assert section_kind("First step is to save the file") is None


def test_candidate_kind_infers_steps_from_numbered_body() -> None:
    body = "1. Open lusrmgr.msc\n2. Reset the password\n"
    assert candidate_kind("Local admin", body=body) == "steps"
    assert candidate_kind("Lab notes") == "custom"
    assert candidate_kind("Background") == "overview"


def test_segment_lines_opens_on_heading_one_or_two() -> None:
    lines = [
        _Line(text="Reset local admin password", heading=True, level=1),
        _Line(text="Use the console."),
        _Line(text="Procedure", heading=True, level=2),
        _Line(text="1. Open lusrmgr.msc", numbered=True),
        _Line(text="2. Set a new password", numbered=True),
    ]
    segments = segment_lines(lines, doc_title="Reset local admin password")
    assert len(segments) == 2
    assert segments[0].candidateKind == "overview"
    assert segments[1].title == "Procedure"
    assert segments[1].candidateKind == "steps"
    assert "lusrmgr" in segments[1].plain_text()


def test_parse_docx_attaches_ingest_segments() -> None:
    document = Document()
    document.add_heading("Overview", level=1)
    document.add_paragraph("Sign in to the VPN.")
    document.add_heading("Step-by-Step Instructions", level=1)
    document.add_paragraph("1. Open the client.")
    document.add_paragraph("2. Click Connect.")

    draft = parse_docx(_bytes(document), "vpn.docx")
    assert draft.ingestSegments
    kinds = [row["candidateKind"] for row in draft.ingestSegments]
    assert "overview" in kinds
    assert "steps" in kinds
