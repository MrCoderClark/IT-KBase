"""Fill Overview, Verification, and Troubleshooting when the upload has none.

The model sees the extracted text only. Pictures are left out. A section that
already came from the document is kept. A failed call leaves the draft as the
parser built it.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from urllib import error, request

from pydantic import BaseModel

from backend.parse.models import ParsedCallout, ParsedDraft
from backend.telemetry import get_logger

log = get_logger(__name__)

_SOURCE_LIMIT = 12_000
_OVERVIEW_LIMIT = 1_200
_SUMMARY_LIMIT = 280

_PROMPT = """You complete an internal IT knowledge article from the procedure below.
Return a JSON object with keys summary, overview, verification, and troubleshooting.
summary is one sentence, at most 240 characters.
overview is two to four sentences of plain prose. No heading and no bullet list. Say what the procedure does.
verification is an array of 2 to 4 strings. Each string is one check that the procedure worked, based on these steps.
troubleshooting is an array of 2 to 3 objects with string keys "title" and "body". title is the problem in a few words. body is one or two sentences on what to try. Stay with this procedure. Do not invent unrelated products or commands.

Material:
"""


class _WrittenCallout(BaseModel):
    title: str = ""
    body: str = ""
    model_config = {"extra": "ignore"}


class _WrittenOverview(BaseModel):
    summary: str = ""
    overview: str = ""
    verification: list[str] = []
    troubleshooting: list[_WrittenCallout] = []
    model_config = {"extra": "ignore"}


def fill_overview(
    draft: ParsedDraft,
    *,
    api_key: str,
    model: str,
    base_url: str,
    complete: Callable[[str], str] | None = None,
) -> ParsedDraft:
    missing = _missing(draft)
    if not missing or not api_key.strip():
        return draft
    source = _source_text(draft)
    if not source:
        return draft
    try:
        raw = (
            complete(source)
            if complete is not None
            else _complete_chat(api_key, model, base_url, source)
        )
        written = _parse_overview(raw)
    except (OSError, error.URLError, json.JSONDecodeError, ValueError, KeyError) as exc:
        log.warning("overview.failed", error=type(exc).__name__)
        return draft
    update = _apply(draft, written, missing)
    if not update:
        return draft
    log.info("overview.written", title=draft.title, sections=sorted(update))
    return draft.model_copy(update=update)


def _missing(draft: ParsedDraft) -> set[str]:
    missing: set[str] = set()
    if not draft.overview.strip():
        missing.add("overview")
    if not draft.verification and not draft.verificationCode.strip():
        missing.add("verification")
    if not any(item.title.strip() or item.body.strip() for item in draft.troubleshooting):
        missing.add("troubleshooting")
    return missing


def _apply(draft: ParsedDraft, written: _WrittenOverview, missing: set[str]) -> dict[str, object]:
    update: dict[str, object] = {}
    if "overview" in missing:
        overview = " ".join(written.overview.split())[:_OVERVIEW_LIMIT].strip()
        if overview:
            update["overview"] = overview
            if not draft.summary.strip():
                summary = " ".join(written.summary.split())[:_SUMMARY_LIMIT].strip()
                if summary:
                    update["summary"] = summary
    if "verification" in missing:
        checks = [" ".join(item.split())[:240].strip() for item in written.verification]
        checks = [item for item in checks if item][:4]
        if checks:
            update["verification"] = checks
    if "troubleshooting" in missing:
        callouts = [
            ParsedCallout(
                title=" ".join(item.title.split())[:80].strip(),
                body=" ".join(item.body.split())[:500].strip(),
            )
            for item in written.troubleshooting
        ]
        callouts = [item for item in callouts if item.title and item.body][:3]
        if callouts:
            update["troubleshooting"] = callouts
    return update


def _source_text(draft: ParsedDraft) -> str:
    lines = [f"Title: {draft.title}"]
    if draft.summary.strip():
        lines.append(draft.summary.strip())
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


def _parse_overview(raw: str) -> _WrittenOverview:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.removesuffix("```").strip()
    payload = json.loads(text)
    if not isinstance(payload, dict):
        raise ValueError("overview response was not an object")
    return _WrittenOverview.model_validate(payload)


def _complete_chat(api_key: str, model: str, base_url: str, source: str) -> str:
    url = base_url.rstrip("/") + "/chat/completions"
    body = json.dumps(
        {
            "model": model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": "You return JSON only."},
                {"role": "user", "content": _PROMPT + source},
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
        with request.urlopen(call, timeout=45) as response:
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
