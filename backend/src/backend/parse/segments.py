"""Segment normalized lines into LLM suggestions (spec 05 §3.3).

A Heading 1 or 2 opens a new segment. Candidate kinds are lexical hints only —
the extractor may remap them.
"""

from __future__ import annotations

import re
from typing import Any, Protocol

from pydantic import BaseModel, Field

# Earlier rows win, so "Troubleshooting steps" stays troubleshooting.
_KINDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("troubleshooting", ("troubleshoot", "known issue", "faq")),
    ("prerequisites", ("prerequisite", "requirement", "before you begin", "what you need")),
    ("verification", ("verification", "verify", "expected result")),
    ("steps", ("step-by-step", "step by step", "procedure", "instructions", "walkthrough", "how to", "step")),
    ("overview", ("overview", "summary", "introduction", "purpose", "background")),
)

_STEP_START = re.compile(r"^(?:step\s+)?\d+[.)]\s+\S", re.IGNORECASE)
_CANONICAL = frozenset(
    {"overview", "prerequisites", "steps", "verification", "troubleshooting", "custom"}
)


class TextBlock(BaseModel):
    type: str = "text"
    text: str = ""
    listItem: bool = False
    numbered: bool = False
    code: bool = False
    images: list[str] = Field(default_factory=list)


class Segment(BaseModel):
    title: str
    headingLevel: int = 1
    candidateKind: str = "custom"
    blocks: list[TextBlock] = Field(default_factory=list)

    def plain_text(self) -> str:
        parts: list[str] = []
        for block in self.blocks:
            if block.text.strip():
                parts.append(block.text.strip())
        return "\n".join(parts)


class DocMeta(BaseModel):
    title: str = ""
    filename: str = ""
    sourceKind: str = ""


class LineLike(Protocol):
    text: str
    heading: bool
    level: int
    list_item: bool
    numbered: bool
    code: bool
    images: list[str]


def section_kind(title: str) -> str | None:
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


def candidate_kind(title: str, *, body: str = "") -> str:
    """Suggested canonical kind for a segment (never None)."""
    known = section_kind(title)
    if known:
        return known
    if _body_looks_like_steps(body):
        return "steps"
    if title.strip():
        return "custom"
    return "overview"


def segment_lines(
    lines: list[LineLike],
    *,
    doc_title: str = "",
) -> list[Segment]:
    """Walk lines in order. Heading level 1-2 opens a segment."""
    segments: list[Segment] = []
    current: Segment | None = None
    title_fold = " ".join(doc_title.casefold().split()) if doc_title else ""

    def flush() -> None:
        nonlocal current
        if current is None:
            return
        body = current.plain_text()
        current.candidateKind = candidate_kind(current.title, body=body)
        if current.title.strip() or body or any(block.images for block in current.blocks):
            segments.append(current)
        current = None

    for line in lines:
        text = (line.text or "").strip()
        if line.heading and (line.level or 1) <= 2:
            if title_fold and text.casefold() == title_fold:
                continue
            flush()
            current = Segment(title=text or "Section", headingLevel=line.level or 1, blocks=[])
            continue
        if current is None:
            current = Segment(title="Introduction", headingLevel=1, candidateKind="overview", blocks=[])
        if not text and not line.images:
            continue
        current.blocks.append(
            TextBlock(
                type="code" if line.code else "text",
                text=text,
                listItem=bool(line.list_item),
                numbered=bool(line.numbered) or bool(_STEP_START.match(text)),
                code=bool(line.code),
                images=list(line.images or []),
            )
        )

    flush()
    if not segments:
        return [
            Segment(
                title="Overview",
                headingLevel=1,
                candidateKind="overview",
                blocks=[TextBlock(text="")],
            )
        ]
    return segments


def segments_to_prompt(segments: list[Segment]) -> str:
    """Compact candidate_sections block for the structure prompt."""
    parts = ["Candidate sections (kind is a suggestion, not a lock):"]
    for index, segment in enumerate(segments, start=1):
        kind = segment.candidateKind if segment.candidateKind in _CANONICAL else "custom"
        parts.append(f"{index}. [{kind}] {segment.title}")
        body = segment.plain_text()
        if body:
            parts.append(body)
        image_count = sum(len(block.images) for block in segment.blocks)
        if image_count:
            parts.append(f"({image_count} image(s) in this section)")
    return "\n".join(parts)


def segments_as_dicts(segments: list[Segment]) -> list[dict[str, Any]]:
    return [segment.model_dump() for segment in segments]


def _body_looks_like_steps(body: str) -> bool:
    hits = 0
    for line in body.splitlines():
        if _STEP_START.match(line.strip()):
            hits += 1
            if hits >= 2:
                return True
    return False
