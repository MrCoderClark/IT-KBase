"""Low-fidelity parse via ``unstructured`` when python-docx / pdfplumber fail.

Spec 05 §3.1: on primary parser error, partition the raw bytes, assemble the
same draft shape, and mark ``lowFidelitySource``.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from io import BytesIO
from typing import Any

from backend.parse.docx import DocxError, _Line, assemble_draft
from backend.parse.models import ParsedDraft
from backend.telemetry import get_logger

log = get_logger(__name__)

_STEP_START = re.compile(r"^(?:step\s+)?\d+[.)]\s+\S", re.IGNORECASE)
_HEADING_CATS = frozenset(
    {
        "Title",
        "Header",
        "Heading",
        "SectionHeader",
        "Headline",
    }
)
_LIST_CATS = frozenset({"ListItem"})
_NOTE = (
    "This file was read with the low-fidelity fallback parser. "
    "Review headings and steps carefully before publishing."
)
_WARNING = "Low-fidelity source: unstructured fallback was used."

PartitionFn = Callable[..., list[Any]]


class UnstructuredError(Exception):
    """Fallback could not produce a draft. Message is safe to show."""


def elements_to_lines(elements: list[Any]) -> list[_Line]:
    """Map unstructured elements into the shared Word/PDF line shape."""
    lines: list[_Line] = []
    for element in elements:
        text = _element_text(element)
        if not text:
            continue
        category = _category(element)
        if category in _HEADING_CATS:
            lines.append(_Line(text=text, heading=True, level=_heading_level(element)))
            continue
        numbered = bool(_STEP_START.match(text))
        if category in _LIST_CATS or numbered:
            lines.append(_Line(text=text, list_item=True, numbered=numbered))
            continue
        lines.append(_Line(text=text))
    return lines


def parse_unstructured(
    data: bytes,
    filename: str,
    *,
    partition_fn: PartitionFn | None = None,
) -> ParsedDraft:
    """Partition bytes with unstructured and assemble a draft."""
    if not data:
        raise UnstructuredError("That document has no text to import.")

    partition = partition_fn or _default_partition
    try:
        elements = list(
            partition(
                file=BytesIO(data),
                metadata_filename=filename,
            )
            or []
        )
    except UnstructuredError:
        raise
    except Exception as exc:
        log.warning("parse.unstructured_failed", error=type(exc).__name__, filename=filename)
        raise UnstructuredError("The fallback parser could not read that file.") from exc

    lines = elements_to_lines(elements)
    if not lines:
        raise UnstructuredError("That document has no text to import.")

    try:
        draft = assemble_draft(filename, lines)
    except DocxError as exc:
        raise UnstructuredError(str(exc)) from exc

    notes = f"{draft.readingNotes}\n\n{_NOTE}".strip() if draft.readingNotes else _NOTE
    return draft.model_copy(
        update={
            "lowFidelitySource": True,
            "readingNotes": notes,
            "validationWarnings": list(
                dict.fromkeys([*draft.validationWarnings, _WARNING])
            ),
        }
    )


def _default_partition(**kwargs: Any) -> list[Any]:
    try:
        from unstructured.partition.auto import partition
    except ImportError as exc:
        raise UnstructuredError(
            "The unstructured fallback is not installed on this service."
        ) from exc
    return list(partition(**kwargs) or [])


def _element_text(element: Any) -> str:
    raw = getattr(element, "text", None)
    if isinstance(raw, str) and raw.strip():
        return " ".join(raw.split()).strip()
    text = str(element).strip()
    return " ".join(text.split()).strip() if text else ""


def _category(element: Any) -> str:
    cat = getattr(element, "category", None)
    if isinstance(cat, str) and cat.strip():
        return cat.strip()
    return type(element).__name__


def _heading_level(element: Any) -> int:
    meta = getattr(element, "metadata", None)
    depth = getattr(meta, "category_depth", None) if meta is not None else None
    if isinstance(depth, int) and 1 <= depth <= 3:
        return depth
    category = _category(element)
    if category == "Title":
        return 1
    return 2
