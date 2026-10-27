"""Text PDFs become the same draft shape as a Word file. Scans are noted."""

from __future__ import annotations

import base64

import pytest
from fastapi.testclient import TestClient
from fpdf import FPDF

from backend.parse.pdf import PdfError, _collapse_tracking, _rows, parse_pdf

_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _pdf() -> FPDF:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    return pdf


def _line(pdf: FPDF, text: str, size: int) -> None:
    pdf.set_font("Helvetica", size=size)
    pdf.multi_cell(0, 8, text)
    pdf.ln(1)


def _bytes(pdf: FPDF) -> bytes:
    return bytes(pdf.output())


def test_headings_map_into_article_sections() -> None:
    pdf = _pdf()
    pdf.set_title("Linux SSH Key Rotation")
    pdf.add_page()
    _line(pdf, "Overview", 18)
    _line(pdf, "Keys are rotated every 90 days.", 12)
    _line(pdf, "Prerequisites", 18)
    _line(pdf, "Root access", 12)
    _line(pdf, "Procedure", 18)
    _line(pdf, "1. Open the host", 12)
    _line(pdf, "2. Generate a key", 12)

    draft = parse_pdf(_bytes(pdf), "ssh.pdf")

    assert draft.title == "Linux SSH Key Rotation"
    assert "Keys are rotated every 90 days." in draft.overview
    assert draft.prerequisites == ["Root access"]
    assert draft.steps[0].title == "Open the host"
    assert draft.steps[1].title == "Generate a key"


def test_numbered_procedure_without_a_steps_heading() -> None:
    pdf = _pdf()
    pdf.set_title("Access Onet client files")
    pdf.add_page()
    _line(pdf, "1. Log into Microsoft OneDrive", 12)
    _line(pdf, "Use the company account.", 12)
    _line(pdf, "2. Open the recycle bin", 12)

    draft = parse_pdf(_bytes(pdf), "onet.pdf")

    assert draft.steps[0].title == "Log into Microsoft OneDrive"
    assert "company account" in draft.steps[0].body
    assert draft.steps[1].title == "Open the recycle bin"


def test_a_picture_page_is_noted_and_not_read(tmp_path) -> None:
    image = tmp_path / "dot.png"
    image.write_bytes(_PNG)
    pdf = _pdf()
    pdf.add_page()
    _line(pdf, "Flush the cache with ipconfig /flushdns.", 12)
    pdf.add_page()
    pdf.image(str(image), x=10, y=10, w=30)

    draft = parse_pdf(_bytes(pdf), "cache.pdf")

    assert "flushdns" in draft.overview or "flushdns" in draft.summary
    assert "Page 2" in draft.readingNotes
    assert "not available yet" in draft.readingNotes


def test_a_scan_only_pdf_is_refused(tmp_path) -> None:
    image = tmp_path / "dot.png"
    image.write_bytes(_PNG)
    pdf = _pdf()
    pdf.add_page()
    pdf.image(str(image), x=10, y=10, w=30)

    with pytest.raises(PdfError, match="scanned"):
        parse_pdf(_bytes(pdf), "scan.pdf")


def test_a_large_title_does_not_turn_the_page_into_steps() -> None:
    pdf = _pdf()
    pdf.set_title("WFNJ Flow Process")
    pdf.add_page()
    _line(pdf, "2. Referral Outreach", 18)
    _line(pdf, "First step is to save the excel file from the county.", 12)
    _line(pdf, "Click Import, then Data Import Wizard.", 12)

    draft = parse_pdf(_bytes(pdf), "wfnj.pdf")

    assert draft.steps == []
    assert "Referral Outreach" in draft.overview
    assert "save the excel file" in f"{draft.summary} {draft.overview}"
    assert "Data Import Wizard" in f"{draft.summary} {draft.overview}"


def test_a_wrapped_sentence_is_not_a_section() -> None:
    pdf = _pdf()
    pdf.set_title("Intake")
    pdf.add_page()
    _line(pdf, "Send a reminder, as well as", 12)
    _line(pdf, "instructions to complete the Intake Form via DocuSign.", 12)
    _line(pdf, "Click Save.", 12)

    draft = parse_pdf(_bytes(pdf), "intake.pdf")

    assert draft.steps == []
    assert "Intake Form" in f"{draft.summary} {draft.overview}"
    assert "Click Save." in f"{draft.summary} {draft.overview}"


def test_spaced_letters_collapse() -> None:
    assert _collapse_tracking("R E F E R R A L") == "REFERRAL"


def test_a_wide_gap_in_spaced_letters_stays_a_word_space() -> None:
    words: list[dict] = []
    left = 10.0
    for char in "OUTREACH":
        words.append({"text": char, "x0": left, "x1": left + 4, "top": 10, "size": 11})
        left += 6
    left += 8
    for char in "TO":
        words.append({"text": char, "x0": left, "x1": left + 4, "top": 10, "size": 11})
        left += 6

    rows = _rows(words)

    assert rows == [("OUTREACH TO", 11.0)]


def test_non_pdf_bytes_are_refused() -> None:
    with pytest.raises(PdfError, match="not a PDF"):
        parse_pdf(b"this is not a pdf", "notes.pdf")


def test_parse_pdf_route_requires_a_bearer_token(client: TestClient) -> None:
    response = client.post(
        "/v1/parse/pdf",
        files={"file": ("policy.pdf", b"%PDF-1.4 not-a-real-pdf", "application/pdf")},
    )
    assert response.status_code == 401
