"""Post-extract draft checks (spec 05 §3.5).

Soft-fix mild issues. When the structured draft is still unusable, fall back to
a low-confidence parser draft the human can fix.
"""

from __future__ import annotations

from dataclasses import dataclass

from backend.parse.models import ParsedCallout, ParsedDraft, ParsedStep
from backend.parse.segments import Segment

_TITLE_LIMIT = 160
_SUMMARY_LIMIT = 280
_CALLOUT_VARIANTS = frozenset({"info", "important", "warning", "success"})


@dataclass
class ValidateResult:
    draft: ParsedDraft
    warnings: list[str]
    low_confidence: bool


def validate_draft(draft: ParsedDraft, *, parser_draft: ParsedDraft) -> ValidateResult:
    """Return a publishable draft, or a low-confidence parser fallback."""
    fixed, soft_warnings = soft_fix(draft)
    errors = check_draft(fixed)
    if not errors:
        return ValidateResult(draft=fixed, warnings=soft_warnings, low_confidence=False)

    if _has_body(parser_draft):
        fallback = low_confidence_from_parser(parser_draft, errors)
        return ValidateResult(
            draft=fallback,
            warnings=soft_warnings
            + errors
            + ["Structure could not be validated; the parser draft was kept for you to fix."],
            low_confidence=True,
        )

    # Nothing usable — caller treats empty title as a hard fail.
    empty = fixed.model_copy(
        update={
            "title": "",
            "lowConfidence": True,
            "validationWarnings": soft_warnings + errors,
        }
    )
    return ValidateResult(draft=empty, warnings=soft_warnings + errors, low_confidence=True)


def soft_fix(draft: ParsedDraft) -> tuple[ParsedDraft, list[str]]:
    warnings: list[str] = []
    title = " ".join(draft.title.split()).strip()
    if len(title) > _TITLE_LIMIT:
        title = title[:_TITLE_LIMIT].rstrip()
        warnings.append(f"Title was clipped to {_TITLE_LIMIT} characters.")

    summary = " ".join(draft.summary.split()).strip()
    if len(summary) > _SUMMARY_LIMIT:
        summary = summary[:_SUMMARY_LIMIT].rstrip()
        warnings.append(f"Summary was clipped to {_SUMMARY_LIMIT} characters.")

    steps: list[ParsedStep] = []
    for step in draft.steps:
        images = [url for url in step.images if _image_ok(url)]
        if len(images) != len(step.images):
            warnings.append("Dropped an invalid step image reference.")
        cleaned = ParsedStep(
            title=" ".join(step.title.split()).strip() or "Step",
            body=step.body.strip(),
            code=step.code.strip(),
            images=images,
        )
        if cleaned.title == "Step" and not cleaned.body and not cleaned.code and not cleaned.images:
            continue
        steps.append(cleaned)

    callouts: list[ParsedCallout] = []
    for item in draft.troubleshooting:
        variant = item.variant
        if variant and variant not in _CALLOUT_VARIANTS:
            warnings.append(f"Cleared unknown callout variant {variant!r}.")
            variant = None
        if not item.title.strip() and not item.body.strip():
            continue
        callouts.append(
            ParsedCallout(
                title=item.title.strip(),
                body=item.body.strip(),
                variant=variant,
            )
        )

    prerequisites = [item.strip() for item in draft.prerequisites if item.strip()]
    verification = [item.strip() for item in draft.verification if item.strip()]

    return (
        draft.model_copy(
            update={
                "title": title,
                "summary": summary,
                "steps": steps,
                "prerequisites": prerequisites,
                "verification": verification,
                "troubleshooting": callouts,
                "lowConfidence": False,
                # Keep parser/fallback warnings (e.g. lowFidelitySource); soft
                # warnings are returned separately and merged by the caller.
            }
        ),
        warnings,
    )


def check_draft(draft: ParsedDraft) -> list[str]:
    errors: list[str] = []
    title = draft.title.strip()
    if not title:
        errors.append("Title is required.")
    elif len(title) > _TITLE_LIMIT:
        errors.append(f"Title must be at most {_TITLE_LIMIT} characters.")

    if not _has_body(draft):
        errors.append("At least one section with content is required.")

    for index, step in enumerate(draft.steps, start=1):
        if not step.title.strip() and not step.body.strip() and not step.code.strip():
            errors.append(f"Step {index} is empty.")
        for url in step.images:
            if not _image_ok(url):
                errors.append(f"Step {index} references an invalid image.")

    for index, item in enumerate(draft.troubleshooting, start=1):
        if item.variant and item.variant not in _CALLOUT_VARIANTS:
            errors.append(f"Troubleshooting item {index} has an invalid callout variant.")

    return errors


def low_confidence_from_parser(parser_draft: ParsedDraft, errors: list[str]) -> ParsedDraft:
    """Human-fixable draft: segment text as freeform overview, keep parser steps/images."""
    parts: list[str] = []
    for row in parser_draft.ingestSegments or []:
        try:
            segment = Segment.model_validate(row)
        except (TypeError, ValueError):
            continue
        body = segment.plain_text().strip()
        title = segment.title.strip() or "Section"
        if title and body:
            parts.append(f"{title}\n\n{body}")
        elif body:
            parts.append(body)
        elif title:
            parts.append(title)
    overview = "\n\n".join(parts).strip() or parser_draft.overview
    title = parser_draft.title.strip() or "Imported article"
    if len(title) > _TITLE_LIMIT:
        title = title[:_TITLE_LIMIT].rstrip()
    summary = parser_draft.summary.strip()
    if not summary and overview:
        summary = overview.split("\n", 1)[0].strip()[:_SUMMARY_LIMIT]
    return parser_draft.model_copy(
        update={
            "title": title,
            "summary": summary,
            "overview": overview,
            "lowConfidence": True,
            "validationWarnings": list(errors),
        }
    )


def _has_body(draft: ParsedDraft) -> bool:
    if draft.overview.strip():
        return True
    if draft.prerequisites or draft.verification or draft.troubleshooting:
        return True
    if draft.verificationCode.strip():
        return True
    return any(
        step.title.strip() or step.body.strip() or step.code.strip() or step.images
        for step in draft.steps
    )


def _image_ok(url: str) -> bool:
    value = (url or "").strip()
    return value.startswith("data:") or value.startswith("https://") or value.startswith("http://")
