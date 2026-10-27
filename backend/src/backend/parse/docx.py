"""Turn a .docx into the five article sections.

Headings whose text matches a known section name open that section.
A numbered procedure with no such heading still becomes steps, and each
picture stays on the step it follows. The first other heading is the
article title when the file has no core title. Later unmatched headings
are kept in Overview so the text is not dropped.
"""

from __future__ import annotations

import base64
import re
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from zipfile import BadZipFile

from docx import Document
from docx.document import Document as DocumentObject
from docx.opc.exceptions import PackageNotFoundError
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

from backend.parse.models import ParsedCallout, ParsedDraft, ParsedStep

_MAX_CHARS = 200_000
_MAX_IMAGES = 12
_MAX_IMAGE_BYTES = 5_000_000
_SUMMARY_LIMIT = 280
_TITLE_LIMIT = 180
_DECIMAL_FORMATS = {"decimal", "decimalZero"}

# Earlier rows win, so "Troubleshooting steps" stays troubleshooting.
_KINDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("troubleshooting", ("troubleshoot", "known issue", "faq")),
    ("prerequisites", ("prerequisite", "requirement", "before you begin", "what you need")),
    ("verification", ("verification", "verify", "expected result")),
    ("steps", ("step-by-step", "step by step", "procedure", "instructions", "walkthrough", "how to", "step")),
    ("overview", ("overview", "summary", "introduction", "purpose", "background")),
)

_STEP_START = re.compile(r"^(?:step\s+)?\d+[.)]\s+\S", re.IGNORECASE)


class DocxError(Exception):
    """The file cannot become a draft. The message is safe to show."""


@dataclass
class _Line:
    text: str
    list_item: bool = False
    numbered: bool = False
    code: bool = False
    heading: bool = False
    level: int = 1
    images: list[str] = field(default_factory=list)


@dataclass
class _Section:
    kind: str
    title: str
    level: int
    lines: list[_Line] = field(default_factory=list)


class _Budget:
    def __init__(self) -> None:
        self.left = _MAX_CHARS
        self.truncated = False

    def take(self, text: str) -> str:
        if self.truncated or not text:
            return ""
        if len(text) <= self.left:
            self.left -= len(text)
            return text
        self.truncated = True
        cut = text[: self.left].rstrip()
        self.left = 0
        return cut


def assemble_draft(filename: str, lines: list[_Line], *, title: str = "") -> ParsedDraft:
    """Build a draft from lines the Word or PDF reader already classified."""
    parser = _Parser(filename=filename, core_title=_clean(title, _TITLE_LIMIT), core_subject="")
    for line in lines:
        if line.heading:
            parser.add_heading(line.text, line.level or 1)
        else:
            parser.add_line(line)
    draft = parser.finish()
    if not _has_body(draft):
        raise DocxError("That document has no text to import.")
    return draft


def section_kind(title: str) -> str | None:
    """Known section name, or None when the line is ordinary text."""
    return _classify(title)


def parse_docx(data: bytes, filename: str) -> ParsedDraft:
    try:
        document = Document(BytesIO(data))
    except (PackageNotFoundError, ValueError, BadZipFile) as exc:
        raise DocxError("That file is not a Word document.") from exc

    parser = _Parser(
        filename=filename,
        core_title=_clean(document.core_properties.title or "", _TITLE_LIMIT),
        core_subject=_clean(document.core_properties.subject or "", 500),
    )
    for block in _iter_blocks(document):
        if isinstance(block, Table):
            for row in _table_rows(block):
                parser.add_line(_Line(text=row))
            continue
        text = _paragraph_text(block)
        level = _heading_level(block)
        if level is not None and text:
            parser.add_heading(text, level)
            continue
        images = _paragraph_images(block)
        if not text and not images:
            continue
        listed, numbered = _list_flags(block, text)
        parser.add_line(
            _Line(
                text=text,
                list_item=listed,
                numbered=numbered,
                code=_is_code(block),
                images=images,
            )
        )

    draft = parser.finish()
    if not _has_body(draft):
        raise DocxError("That document has no text to import.")
    return draft


class _Parser:
    def __init__(self, filename: str, core_title: str, core_subject: str) -> None:
        self.filename = filename
        self.core_title = core_title
        self.core_subject = core_subject
        self.title_heading: str | None = None
        self.title_level = 1
        self.intro: list[_Line] = []
        self.sections: list[_Section] = []
        self.current: _Section | None = None
        self.budget = _Budget()
        self.image_count = 0

    def add_heading(self, text: str, level: int) -> None:
        text = self.budget.take(text)
        if not text:
            return
        if self.core_title and text.casefold() == self.core_title.casefold():
            return
        kind = _classify(text)
        if (
            kind is None
            and not self.core_title
            and self.title_heading is None
            and not self.sections
            and not self.intro
        ):
            self.title_heading = text[:_TITLE_LIMIT]
            self.title_level = level
            return
        if kind is not None:
            self._start(kind, text, level)
            return
        if self.current is not None and level > self.current.level:
            self.current.lines.append(_Line(text=text, heading=True))
            return
        if self.current is None and self.title_heading and level > self.title_level:
            self.intro.append(_Line(text=text, heading=True))
            return
        self._start("custom", text, level)

    def add_line(self, line: _Line) -> None:
        line.text = self.budget.take(line.text) if line.text else ""
        if line.images:
            room = _MAX_IMAGES - self.image_count
            line.images = line.images[: max(room, 0)]
            self.image_count += len(line.images)
        if not line.text and not line.images:
            return
        if self.current is None:
            self.intro.append(line)
        else:
            self.current.lines.append(line)

    def finish(self) -> ParsedDraft:
        intro = self.intro
        summary = self.core_subject
        promoted: list[ParsedStep] = []
        if not any(section.kind == "steps" for section in self.sections):
            pool = list(intro)
            overview_sections = [section for section in self.sections if section.kind == "overview"]
            for section in overview_sections:
                pool.extend(section.lines)
            promoted, leftover = _promote_procedure(pool)
            if promoted:
                intro = leftover
                for section in overview_sections:
                    section.lines = []
        if not summary and (len(intro) > 1 or self.sections or promoted):
            summary, intro = _peel_summary(intro)

        overview_title = "Overview"
        saw_overview = False
        overview_parts = [_text(intro)]
        prerequisites: list[str] = []
        prerequisites_title = "Prerequisites"
        steps: list[ParsedStep] = []
        steps_title = "Step-by-Step Instructions"
        verification: list[str] = []
        verification_title = "Verification"
        verification_code: list[str] = []
        troubleshooting: list[ParsedCallout] = []
        troubleshooting_title = "Troubleshooting"

        for section in self.sections:
            if section.kind == "overview":
                if not saw_overview:
                    overview_title = section.title
                    saw_overview = True
                overview_parts.append(_text(section.lines))
            elif section.kind == "custom":
                overview_parts.append(_text([_Line(text=section.title, heading=True), *section.lines]))
            elif section.kind == "prerequisites":
                if not prerequisites:
                    prerequisites_title = section.title
                prerequisites.extend(_items(section.lines))
            elif section.kind == "steps":
                if not steps:
                    steps_title = section.title
                steps.extend(_steps(section.lines))
            elif section.kind == "verification":
                if not verification and not verification_code:
                    verification_title = section.title
                verification.extend(_items(line for line in section.lines if not line.code))
                verification_code.extend(line.text for line in section.lines if line.code)
            elif section.kind == "troubleshooting":
                if not troubleshooting:
                    troubleshooting_title = section.title
                troubleshooting.extend(_callouts(section.lines))

        if self.budget.truncated:
            overview_parts.append("Import stopped after 200,000 characters.")
        if not steps and promoted:
            steps = promoted

        title = self.core_title or self.title_heading or _title_from_filename(self.filename)
        return ParsedDraft(
            title=title or "Imported article",
            summary=summary,
            overviewTitle=overview_title,
            overview="\n\n".join(part for part in overview_parts if part).strip(),
            prerequisitesTitle=prerequisites_title,
            prerequisites=prerequisites,
            stepsTitle=steps_title,
            steps=steps,
            verificationTitle=verification_title,
            verification=verification,
            verificationCode="\n".join(verification_code).strip(),
            troubleshootingTitle=troubleshooting_title,
            troubleshooting=troubleshooting,
        )

    def _start(self, kind: str, title: str, level: int) -> None:
        self.current = _Section(kind=kind, title=title[:120], level=level)
        self.sections.append(self.current)


def _classify(title: str) -> str | None:
    """Match a heading, not a sentence that merely contains the word.

    "Prerequisites" hits "prerequisite". "First step is to save the file"
    stays body text, because "step" is not the heading.
    """
    lowered = " ".join(title.casefold().split())
    if not lowered or len(lowered) > 80:
        return None
    words = lowered.split()
    for kind, phrases in _KINDS:
        for phrase in phrases:
            if " " in phrase:
                if lowered.startswith(phrase):
                    return kind
            elif words[0].startswith(phrase):
                return kind
    return None


def _iter_blocks(document: DocumentObject):
    for child in document.element.body.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, document)
        elif child.tag == qn("w:tbl"):
            yield Table(child, document)


def _heading_level(paragraph: Paragraph) -> int | None:
    name = paragraph.style.name.casefold() if paragraph.style is not None else ""
    if name == "title":
        return 1
    if name.startswith("heading"):
        digits = "".join(char for char in name if char.isdigit())
        return int(digits) if digits else 1
    p_pr = paragraph._p.pPr
    if p_pr is not None and p_pr.outlineLvl is not None:
        return int(p_pr.outlineLvl.val) + 1
    return None


def _list_flags(paragraph: Paragraph, text: str) -> tuple[bool, bool]:
    listed = False
    numbered = bool(_STEP_START.match(text))
    p_pr = paragraph._p.pPr
    if p_pr is not None and p_pr.numPr is not None:
        listed = True
        if _numbering_fmt(paragraph) in _DECIMAL_FORMATS:
            numbered = True
    name = paragraph.style.name.casefold() if paragraph.style is not None else ""
    if "list" in name:
        listed = True
    if "number" in name:
        numbered = True
    return listed, numbered


def _numbering_fmt(paragraph: Paragraph) -> str | None:
    p_pr = paragraph._p.pPr
    if p_pr is None or p_pr.numPr is None or p_pr.numPr.numId is None:
        return None
    num_id = str(p_pr.numPr.numId.val)
    if num_id == "0":
        return None
    ilvl = "0"
    if p_pr.numPr.ilvl is not None and p_pr.numPr.ilvl.val is not None:
        ilvl = str(p_pr.numPr.ilvl.val)
    try:
        numbering = paragraph.part.numbering_part._element
    except (AttributeError, KeyError, ValueError):
        return None
    num = next(
        (child for child in numbering.findall(qn("w:num")) if child.get(qn("w:numId")) == num_id),
        None,
    )
    abstract_id = num.find(qn("w:abstractNumId")) if num is not None else None
    abstract_val = abstract_id.get(qn("w:val")) if abstract_id is not None else None
    if not abstract_val:
        return None
    abstract = next(
        (
            child
            for child in numbering.findall(qn("w:abstractNum"))
            if child.get(qn("w:abstractNumId")) == abstract_val
        ),
        None,
    )
    if abstract is None:
        return None
    for level in abstract.findall(qn("w:lvl")):
        if level.get(qn("w:ilvl")) != ilvl:
            continue
        fmt = level.find(qn("w:numFmt"))
        if fmt is not None:
            return fmt.get(qn("w:val"))
    return None


def _paragraph_images(paragraph: Paragraph) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for node in paragraph._p.iter():
        if node.tag.rsplit("}", 1)[-1] not in {"blip", "imagedata"}:
            continue
        rel_id = next(
            (
                value
                for key, value in node.attrib.items()
                if key.rsplit("}", 1)[-1] in {"embed", "id"} and value
            ),
            None,
        )
        if not rel_id or rel_id in seen:
            continue
        seen.add(rel_id)
        url = _image_data_url(paragraph, rel_id)
        if url:
            urls.append(url)
    return urls


def _image_data_url(paragraph: Paragraph, rel_id: str) -> str | None:
    part = paragraph.part.related_parts.get(rel_id)
    if part is None:
        return None
    content_type = getattr(part, "content_type", "") or ""
    if not content_type.startswith("image/"):
        return None
    blob = part.blob
    if not blob or len(blob) > _MAX_IMAGE_BYTES:
        return None
    encoded = base64.b64encode(blob).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def _is_code(paragraph: Paragraph) -> bool:
    name = paragraph.style.name.casefold() if paragraph.style is not None else ""
    return "code" in name or "preformatted" in name


def _paragraph_text(paragraph: Paragraph) -> str:
    return _clean(paragraph.text.replace("\xa0", " "), 20_000)


def _table_rows(table: Table) -> list[str]:
    rows: list[str] = []
    for row in table.rows:
        cells: list[str] = []
        for cell in row.cells:
            text = _clean(cell.text.replace("\n", " "), 2_000)
            if text and (not cells or cells[-1] != text):
                cells.append(text)
        if cells:
            rows.append(" | ".join(cells))
    return rows


def _peel_summary(lines: list[_Line]) -> tuple[str, list[_Line]]:
    for index, line in enumerate(lines):
        if line.heading or line.code or line.list_item:
            continue
        if 0 < len(line.text) <= _SUMMARY_LIMIT:
            return line.text, lines[:index] + lines[index + 1 :]
    return "", lines


def _text(lines: list[_Line]) -> str:
    return "\n\n".join(line.text for line in lines if line.text).strip()


def _items(lines) -> list[str]:
    return [line.text for line in lines if line.text]


def _promote_procedure(lines: list[_Line]) -> tuple[list[ParsedStep], list[_Line]]:
    starts = [index for index, line in enumerate(lines) if _is_step_start(line)]
    if len(starts) < 2:
        return [], lines
    first = starts[0]
    return _steps(lines[first:]), lines[:first]


def _steps(lines: list[_Line]) -> list[ParsedStep]:
    if not any(_is_step_start(line) for line in lines):
        return _loose_steps(lines)

    steps: list[ParsedStep] = []
    current: ParsedStep | None = None
    for line in lines:
        if line.images and current is not None and not _is_step_start(line):
            current.images.extend(line.images)
        if line.code:
            if current is None:
                current = ParsedStep(title="Command", code=line.text, images=list(line.images))
                steps.append(current)
            else:
                current.code = _join_code(current.code, line.text)
            continue
        if not line.text:
            continue
        if _is_step_start(line) or line.heading or current is None:
            raw = _strip_number(line.text) if _is_step_start(line) else line.text
            title, extra = _split_title(raw)
            current = ParsedStep(title=title or "Step", body=extra, images=list(line.images))
            steps.append(current)
            continue
        current.body = _join_para(current.body, line.text)
    return [step for step in steps if step.title or step.body or step.code or step.images]


def _loose_steps(lines: list[_Line]) -> list[ParsedStep]:
    steps: list[ParsedStep] = []
    current: ParsedStep | None = None
    for line in lines:
        if not line.text:
            if line.images and current is not None:
                current.images.extend(line.images)
            continue
        if line.code:
            if current is None:
                current = ParsedStep(title="Command", code=line.text, images=list(line.images))
                steps.append(current)
            else:
                current.code = _join_code(current.code, line.text)
                current.images.extend(line.images)
            continue
        title, extra = _split_title(line.text)
        current = ParsedStep(title=title or "Step", body=extra, images=list(line.images))
        steps.append(current)
    return [step for step in steps if step.title or step.body or step.code or step.images]


def _callouts(lines: list[_Line]) -> list[ParsedCallout]:
    if not any(line.heading for line in lines):
        body = _text(lines)
        return [ParsedCallout(body=body)] if body else []

    callouts: list[ParsedCallout] = []
    title = ""
    body: list[str] = []

    def flush() -> None:
        if title or body:
            callouts.append(ParsedCallout(title=title, body="\n\n".join(body).strip()))

    for line in lines:
        if line.heading:
            flush()
            title = line.text
            body = []
        elif line.text:
            body.append(line.text)
    flush()
    return [callout for callout in callouts if callout.title or callout.body]


def _is_step_start(line: _Line) -> bool:
    return line.numbered or bool(_STEP_START.match(line.text))


def _strip_number(text: str) -> str:
    return re.sub(r"^(?:step\s+)?\d+[.)]\s+", "", text, count=1, flags=re.IGNORECASE).strip()


def _split_title(text: str) -> tuple[str, str]:
    text = text.strip()
    if len(text) <= 200:
        return text, ""
    cut = text[:120]
    space = cut.rfind(" ")
    if space > 60:
        cut = cut[:space]
    return cut, text[len(cut) :].strip()


def _join_para(left: str, right: str) -> str:
    if not left:
        return right
    return f"{left}\n\n{right}"


def _join_code(left: str, right: str) -> str:
    if not left:
        return right
    return f"{left}\n{right}"


def _title_from_filename(filename: str) -> str:
    stem = Path(filename).stem.replace("_", " ").replace("-", " ")
    return _clean(stem, _TITLE_LIMIT)


def _clean(value: str, limit: int) -> str:
    text = " ".join(value.replace("\r", " ").replace("\n", " ").split())
    return text[:limit].strip()


def _has_body(draft: ParsedDraft) -> bool:
    return bool(
        draft.summary
        or draft.overview
        or draft.prerequisites
        or draft.steps
        or draft.verification
        or draft.verificationCode
        or draft.troubleshooting
    )
