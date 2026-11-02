"""OpenAI-compatible chat completions as a KBExtractor.

Invalid JSON gets one repair. A failed call leaves the parser draft unchanged.
Pictures stay on the steps the parser found. A section already in the file is
kept when the model returns that field empty.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from urllib import error, request

from pydantic import BaseModel, ValidationError

from backend.parse.models import ParsedCallout, ParsedDraft, ParsedStep
from backend.parse.segments import Segment, segments_to_prompt
from backend.telemetry import get_logger

log = get_logger(__name__)

_SOURCE_LIMIT = 24_000
_SUMMARY_LIMIT = 280
_OVERVIEW_LIMIT = 8_000

_PROMPT = """You are an IT knowledge-base editor. Turn the extracted document into one article.
Lines may be broken because the text was read from a page. Join those lines into paragraphs.
Return a JSON object with keys title, summary, overview, prerequisites, steps, verification, troubleshooting.
title is the document title.
summary is one sentence, at most 240 characters, or an empty string.
overview is plain prose of what the document says. No heading.
prerequisites is an array of strings, empty when the document has none.
steps is an array of objects with keys title, body, and code. code is a command copied verbatim, or an empty string. Use an empty array when the document is not a procedure.
verification is an array of strings, empty when the document has no checks.
troubleshooting is an array of objects with keys title and body, empty when the document has none.
Use only facts present in the material. Return an empty string or empty array for a section the material does not contain. Do not add checks, causes, products, or commands that the material does not contain.

Material:
"""

_REPAIR = """The previous JSON failed validation. Fix only the validation errors and keep the rest identical.
Return JSON only.
"""


class _WrittenCallout(BaseModel):
    title: str = ""
    body: str = ""
    model_config = {"extra": "ignore"}


class _WrittenStep(BaseModel):
    title: str = ""
    body: str = ""
    code: str = ""
    model_config = {"extra": "ignore"}


class _WrittenDraft(BaseModel):
    title: str = ""
    summary: str = ""
    overview: str = ""
    prerequisites: list[str] = []
    steps: list[_WrittenStep] = []
    verification: list[str] = []
    troubleshooting: list[_WrittenCallout] = []
    model_config = {"extra": "ignore"}


class OpenAICompatibleExtractor:
    """Default extractor: OpenRouter or any OpenAI-compatible host."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str,
        complete: Callable[[str], str] | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._base_url = base_url
        self._complete = complete
        self.last_llm: dict[str, str | bool] | None = None

    def structure(self, draft: ParsedDraft) -> ParsedDraft:
        self.last_llm = None
        if not self._api_key.strip():
            return draft
        source = _source_text(draft)
        if not source:
            return draft
        segments = _segments_from_draft(draft)
        if segments:
            prompt = (
                _PROMPT.removesuffix("Material:\n")
                + segments_to_prompt(segments)
                + "\n\nMaterial:\n"
                + source
            )
        else:
            prompt = _PROMPT + source

        def ask(message: str) -> str:
            if self._complete is not None:
                return self._complete(message)
            return _complete_chat(self._api_key, self._model, self._base_url, message)

        try:
            raw = ask(prompt)
        except (OSError, error.URLError, ValueError) as exc:
            log.warning("structure.failed", error=type(exc).__name__)
            return draft

        repaired = False
        try:
            written = _parse_draft(raw)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            repaired_result = _repair(ask, source, raw, exc)
            if repaired_result is None:
                self.last_llm = {"prompt": prompt, "response": raw, "repaired": False}
                return draft
            written, raw = repaired_result
            repaired = True

        self.last_llm = {"prompt": prompt, "response": raw, "repaired": repaired}
        merged = _merge(draft, written)
        log.info("structure.written", title=merged.title)
        return merged


def _repair(
    ask: Callable[[str], str],
    source: str,
    previous: str,
    exc: Exception,
) -> tuple[_WrittenDraft, str] | None:
    message = f"{_REPAIR}\nErrors:\n{exc}\n\nPrevious response:\n{previous}\n\nMaterial:\n{source}"
    try:
        raw = ask(message)
        written = _parse_draft(raw)
    except (OSError, error.URLError, json.JSONDecodeError, ValidationError, ValueError) as repair_exc:
        log.warning("structure.repair_failed", error=type(repair_exc).__name__)
        return None
    return written, raw


def _merge(draft: ParsedDraft, written: _WrittenDraft) -> ParsedDraft:
    steps = _steps(draft, written.steps)
    prerequisites = _strings(written.prerequisites, 20, 240)
    verification = _strings(written.verification, 8, 400)
    troubleshooting = _callouts(written.troubleshooting)
    return draft.model_copy(
        update={
            "title": _clip(written.title, 160) or draft.title,
            "summary": _clip(written.summary, _SUMMARY_LIMIT) or draft.summary,
            "overview": _clip(written.overview, _OVERVIEW_LIMIT) or draft.overview,
            "prerequisites": prerequisites or draft.prerequisites,
            "steps": steps,
            "verification": verification or draft.verification,
            "troubleshooting": troubleshooting or draft.troubleshooting,
        }
    )


def _steps(draft: ParsedDraft, written: list[_WrittenStep]) -> list[ParsedStep]:
    from backend.parse.docx import STEP_IMG_MARK, _join_para

    steps = [
        ParsedStep(
            title=_clip(item.title, 200) or "Step",
            body=_clip(item.body, 4_000),
            code=_clip(item.code, 4_000),
        )
        for item in written
        if item.title.strip() or item.body.strip() or item.code.strip()
    ]
    if not steps:
        return draft.steps
    for index, step in enumerate(steps):
        if index >= len(draft.steps):
            continue
        prev = draft.steps[index]
        if prev.images:
            step.images = list(prev.images)
        # Keep parser body when it already places screenshots in reading order.
        if STEP_IMG_MARK in (prev.body or ""):
            step.body = prev.body
        elif step.images and STEP_IMG_MARK not in step.body:
            for _url in step.images:
                step.body = _join_para(step.body, STEP_IMG_MARK)
    return steps


def _callouts(items: list[_WrittenCallout]) -> list[ParsedCallout]:
    callouts = [
        ParsedCallout(title=_clip(item.title, 80), body=_clip(item.body, 800))
        for item in items
        if item.title.strip() and item.body.strip()
    ]
    return callouts[:8]


def _strings(items: list[str], limit: int, length: int) -> list[str]:
    cleaned = [_clip(item, length) for item in items]
    return [item for item in cleaned if item][:limit]


def _clip(text: str, limit: int) -> str:
    return " ".join(text.split())[:limit].strip()


def _segments_from_draft(draft: ParsedDraft) -> list[Segment]:
    rows = draft.ingestSegments or []
    out: list[Segment] = []
    for row in rows:
        try:
            out.append(Segment.model_validate(row))
        except (TypeError, ValueError):
            continue
    return out


def _source_text(draft: ParsedDraft) -> str:
    lines = [f"Title: {draft.title}"]
    if draft.summary.strip():
        lines.append(draft.summary.strip())
    if draft.overview.strip():
        lines.append(draft.overview.strip())
    lines.extend(f"Prerequisite: {item}" for item in draft.prerequisites if item.strip())
    for index, step in enumerate(draft.steps, start=1):
        if step.title.strip():
            lines.append(f"Step {index}: {step.title.strip()}")
        if step.body.strip():
            lines.append(step.body.strip())
        if step.code.strip():
            lines.append(step.code.strip())
    lines.extend(f"Check: {item}" for item in draft.verification if item.strip())
    if draft.verificationCode.strip():
        lines.append(draft.verificationCode.strip())
    for callout in draft.troubleshooting:
        if callout.title.strip():
            lines.append(callout.title.strip())
        if callout.body.strip():
            lines.append(callout.body.strip())
    return "\n".join(lines)[:_SOURCE_LIMIT].strip()


def _parse_draft(raw: str) -> _WrittenDraft:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.removesuffix("```").strip()
    payload = json.loads(text)
    if not isinstance(payload, dict):
        raise ValueError("structure response was not an object")
    return _WrittenDraft.model_validate(payload)


def _complete_chat(api_key: str, model: str, base_url: str, message: str) -> str:
    url = base_url.rstrip("/") + "/chat/completions"
    body = json.dumps(
        {
            "model": model,
            "temperature": 0.1,
            "messages": [
                {"role": "system", "content": "You return JSON only."},
                {"role": "user", "content": message},
            ],
        }
    ).encode()
    call = request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3001",
            "X-Title": "TechBase",
        },
        method="POST",
    )
    try:
        with request.urlopen(call, timeout=150) as response:
            payload = json.loads(response.read().decode())
    except error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:200]
        raise ValueError(f"HTTP {exc.code}: {detail}") from exc
    content = payload["choices"][0]["message"]["content"]
    if isinstance(content, list):
        content = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part) for part in content
        )
    return str(content)
