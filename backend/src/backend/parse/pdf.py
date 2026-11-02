"""Turn a text PDF into the same draft shape as a Word file.

pdfplumber reads each page from top to bottom. A short known heading, or a
line in a larger font, opens a section. Numbered lines become steps through
the Word assembler. Embedded screenshots are kept on the step they follow
(same data-URL shape as Word). A page with a picture and almost no text is
recorded and left unread. Text recognition of scans is later.
"""

from __future__ import annotations

import base64
import re
from collections import defaultdict
from io import BytesIO

import pdfplumber
from PIL import Image

from backend.parse.docx import (
    _MAX_IMAGE_BYTES,
    DocxError,
    _Line,
    assemble_draft,
    section_kind,
)
from backend.parse.models import ParsedDraft

_PAGE_NUMBER = re.compile(r"^\d{1,4}$")
_STEP_LINE = re.compile(r"^(?:step\s+)?\d+[.)]\s+\S", re.IGNORECASE)
_MIN_TEXT = 25
_HEADING_WORDS = 6
_MIN_IMAGE_PT = 40.0


class PdfError(Exception):
    """The file cannot become a draft. The message is safe to show."""


def parse_pdf(data: bytes, filename: str) -> ParsedDraft:
    if not data.startswith(b"%PDF"):
        raise PdfError("That file is not a PDF.")

    try:
        pdf = pdfplumber.open(BytesIO(data))
    except Exception as exc:  # a corrupt PDF should be a readable error
        raise PdfError("That file is not a PDF.") from exc

    try:
        lines: list[_Line] = []
        scanned: list[int] = []
        for number, page in enumerate(pdf.pages, start=1):
            page_lines, is_scanned = _page_lines(page)
            if is_scanned:
                scanned.append(number)
            lines.extend(page_lines)
        title = _metadata_title(pdf.metadata)
    finally:
        pdf.close()

    if not lines and scanned:
        raise PdfError(
            "That PDF looks like scanned images. Text recognition is not available yet."
        )

    try:
        draft = assemble_draft(filename, lines, title=title)
    except DocxError as exc:
        raise PdfError("That PDF has no text to import.") from exc

    if scanned:
        draft.readingNotes = _scanned_note(scanned)
    return draft


def _page_lines(page) -> tuple[list[_Line], bool]:
    text = (page.extract_text() or "").strip()
    images = list(page.images or [])
    if not images:
        images = list((getattr(page, "objects", None) or {}).get("image") or [])
    if len(text) < _MIN_TEXT and images:
        return [], True
    try:
        words = page.extract_words(extra_attrs=["size"]) or []
    except Exception:  # fall back to plain text when word positions fail
        words = []
    rows = _rows(words) if words else _rows_from_text(text)
    events: list[tuple[float, _Line]] = [*_classify_rows(rows), *_image_events(images)]
    if not events and not text:
        return [], False
    events.sort(key=lambda item: item[0])
    return [line for _top, line in events], False


def _rows(words: list[dict]) -> list[tuple[str, float, float]]:
    bands: dict[int, list[dict]] = defaultdict(list)
    for word in words:
        top = word.get("top")
        if not isinstance(top, (int, float)):
            continue
        bands[round(top)].append(word)

    rows: list[tuple[str, float, float]] = []
    for top in sorted(bands):
        group = sorted(bands[top], key=lambda word: word.get("x0") or 0)
        text = _line_text(group)
        if not text or _PAGE_NUMBER.match(text):
            continue
        sizes = [float(word["size"]) for word in group if isinstance(word.get("size"), (int, float))]
        rows.append((text, max(sizes) if sizes else 0.0, float(top)))
    return _merge_wraps(rows)


def _rows_from_text(text: str) -> list[tuple[str, float, float]]:
    rows: list[tuple[str, float, float]] = []
    for index, raw in enumerate(text.splitlines()):
        line = _normalize_line(raw)
        if line and not _PAGE_NUMBER.match(line):
            rows.append((line, 0.0, float(index)))
    return _merge_wraps(rows)


def _merge_wraps(rows: list[tuple[str, float, float]]) -> list[tuple[str, float, float]]:
    merged: list[tuple[str, float, float]] = []
    for text, size, top in rows:
        if merged and merged[-1][0].endswith("-") and text[:1].islower():
            previous, previous_size, previous_top = merged[-1]
            merged[-1] = (previous[:-1] + text, max(previous_size, size), previous_top)
            continue
        merged.append((text, size, top))
    return merged


def _classify_rows(rows: list[tuple[str, float, float]]) -> list[tuple[float, _Line]]:
    lines: list[tuple[float, _Line]] = []
    for text, _size, top in rows:
        # Numbered procedure lines first — GUI guides often set "2. Confirm…"
        # in a larger face; treating that as a heading would park later screenshots
        # in a custom section where images are dropped.
        if _STEP_LINE.match(text):
            lines.append((top, _Line(text=text, numbered=True)))
            continue
        if section_kind(text) and _is_short_heading(text):
            lines.append((top, _Line(text=text, heading=True, level=1)))
            continue
        lines.append((top, _Line(text=text)))
    return lines


def _image_events(images: list[dict]) -> list[tuple[float, _Line]]:
    events: list[tuple[float, _Line]] = []
    seen: set[int] = set()
    for image in images:
        url = _image_data_url(image, seen)
        if not url:
            continue
        top = image.get("top")
        if not isinstance(top, (int, float)):
            top = 0.0
        events.append((float(top), _Line(text="", images=[url])))
    return events


def _image_data_url(image: dict, seen: set[int]) -> str | None:
    if image.get("imagemask"):
        return None
    width = float(image.get("width") or 0)
    height = float(image.get("height") or 0)
    if width < _MIN_IMAGE_PT or height < _MIN_IMAGE_PT:
        return None
    stream = image.get("stream")
    if stream is None:
        return None
    stream_id = id(stream)
    if stream_id in seen:
        return None
    seen.add(stream_id)
    try:
        raw = stream.get_data()
    except Exception:
        return None
    if not raw or len(raw) > _MAX_IMAGE_BYTES:
        return None

    filters = _filter_names(getattr(stream, "attrs", {}) or {})
    if "DCTDecode" in filters:
        return _data_url("image/jpeg", raw)
    if "JPXDecode" in filters:
        return _data_url("image/jp2", raw)

    attrs = getattr(stream, "attrs", {}) or {}
    pixel_w = int(attrs.get("Width") or 0)
    pixel_h = int(attrs.get("Height") or 0)
    if pixel_w < 1 or pixel_h < 1:
        return None
    mode = _pil_mode(attrs.get("ColorSpace"))
    if mode is None:
        return None
    expected = pixel_w * pixel_h * len(mode)
    if len(raw) < expected:
        return None
    try:
        picture = Image.frombytes(mode, (pixel_w, pixel_h), raw[:expected])
        if mode == "CMYK":
            picture = picture.convert("RGB")
        buffer = BytesIO()
        picture.save(buffer, format="PNG", optimize=True)
        png = buffer.getvalue()
    except Exception:
        return None
    if not png or len(png) > _MAX_IMAGE_BYTES:
        return None
    return _data_url("image/png", png)


def _filter_names(attrs: dict) -> set[str]:
    raw = attrs.get("Filter")
    if raw is None:
        return set()
    if isinstance(raw, list | tuple):
        return {str(item).lstrip("/") for item in raw}
    return {str(raw).lstrip("/")}


def _pil_mode(color_space: object) -> str | None:
    name = str(color_space).lstrip("/")
    if "DeviceGray" in name or name == "G":
        return "L"
    if "DeviceRGB" in name or name == "RGB":
        return "RGB"
    if "DeviceCMYK" in name or name == "CMYK":
        return "CMYK"
    return None


def _data_url(content_type: str, blob: bytes) -> str:
    encoded = base64.b64encode(blob).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def _is_short_heading(text: str) -> bool:
    """A section name is a few words. A wrapped sentence is body text."""
    words = text.split()
    return 0 < len(words) <= _HEADING_WORDS and len(text) <= 80


def _line_text(words: list[dict]) -> str:
    tokens: list[tuple[str, float | None]] = []
    previous_right: float | None = None
    for word in words:
        text = str(word.get("text") or "").strip()
        if not text:
            continue
        left = float(word["x0"]) if isinstance(word.get("x0"), (int, float)) else 0.0
        gap = None if previous_right is None else left - previous_right
        right = word.get("x1")
        previous_right = float(right) if isinstance(right, (int, float)) else left
        tokens.append((text, gap))
    if not tokens:
        return ""
    return _normalize_line(_join_tokens(tokens))


def _join_tokens(tokens: list[tuple[str, float | None]]) -> str:
    """Join spaced-out letters, and keep a wide gap as a word space."""
    singles = sum(1 for text, _gap in tokens if len(text) == 1)
    tracked = len(tokens) >= 4 and singles / len(tokens) >= 0.6
    letter_gap = _typical_gap(tokens) if tracked else None
    chunks: list[str] = []
    letters = ""
    for text, gap in tokens:
        if tracked and len(text) == 1 and text.isalnum():
            if letters and letter_gap is not None and gap is not None and gap > letter_gap * 1.8:
                chunks.append(letters)
                letters = ""
            letters += text
            continue
        if letters:
            chunks.append(letters)
            letters = ""
        chunks.append(text)
    if letters:
        chunks.append(letters)
    return " ".join(chunks)


def _typical_gap(tokens: list[tuple[str, float | None]]) -> float | None:
    gaps = sorted(
        gap
        for text, gap in tokens
        if gap is not None and gap >= 0 and len(text) == 1
    )
    if not gaps:
        return None
    return gaps[len(gaps) // 2]


def _normalize_line(text: str) -> str:
    collapsed = _collapse_tracking(" ".join(text.split()))
    return re.sub(r"(\d)\s+\.", r"\1.", collapsed).strip()


def _collapse_tracking(text: str) -> str:
    """Join letters that a design tool spaced out: 'R E A D' becomes 'READ'."""
    parts = text.split()
    if len(parts) < 4:
        return text
    singles = sum(1 for part in parts if len(part) == 1)
    if singles / len(parts) < 0.6:
        return text
    chunks: list[str] = []
    letters = ""
    for part in parts:
        if len(part) == 1 and part.isalnum():
            letters += part
            continue
        if letters:
            chunks.append(letters)
            letters = ""
        chunks.append(part)
    if letters:
        chunks.append(letters)
    return " ".join(chunks)


def _metadata_title(metadata: object) -> str:
    if not isinstance(metadata, dict):
        return ""
    raw = metadata.get("Title") or ""
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", "replace")
    return str(raw).strip()


def _scanned_note(pages: list[int]) -> str:
    if len(pages) == 1:
        label = f"Page {pages[0]} looks scanned and was not read."
    else:
        shown = ", ".join(str(number) for number in pages)
        label = f"Pages {shown} look scanned and were not read."
    return f"{label} Text recognition is not available yet."
