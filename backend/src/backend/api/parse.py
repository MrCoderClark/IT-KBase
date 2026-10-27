"""POST /v1/parse/docx and /v1/parse/pdf — a file becomes a draft."""

from __future__ import annotations

from collections.abc import Callable, Iterator

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from auth_py import Principal
from backend.config import get_ai_settings
from backend.parse.docx import DocxError, parse_docx
from backend.parse.models import ParsedDraft
from backend.parse.overview import structure_draft
from backend.parse.pdf import PdfError, parse_pdf
from backend.progress import ProgressEvent, StageClock
from backend.telemetry import get_logger

log = get_logger(__name__)

_MAX_BYTES = 25 * 1024 * 1024


def build_parse_router(dependency) -> APIRouter:
    router = APIRouter(tags=["parse"])
    get_principal = Depends(dependency)

    @router.post("/v1/parse/docx", response_model=ParsedDraft)
    async def parse_docx_route(
        file: UploadFile,
        principal: Principal = get_principal,
    ) -> ParsedDraft:
        name, data = await _upload(file, principal, suffix=".docx", fallback="document.docx")
        if len(data) < 4 or data[:2] != b"PK":
            raise HTTPException(status_code=422, detail="That file is not a Word document.")
        return _finish(parse_docx, data, name, "docx.parsed")

    @router.post("/v1/parse/pdf", response_model=ParsedDraft)
    async def parse_pdf_route(
        file: UploadFile,
        principal: Principal = get_principal,
    ) -> ParsedDraft:
        name, data = await _upload(file, principal, suffix=".pdf", fallback="document.pdf")
        if not data.startswith(b"%PDF"):
            raise HTTPException(status_code=422, detail="That file is not a PDF.")
        return _finish(parse_pdf, data, name, "pdf.parsed")

    return router


async def _upload(
    file: UploadFile,
    principal: Principal,
    *,
    suffix: str,
    fallback: str,
) -> tuple[str, bytes]:
    if principal.kind != "user" or principal.role not in {"author", "reviewer", "admin"}:
        raise HTTPException(status_code=403, detail="You cannot import articles.")

    name = (file.filename or fallback).rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if not name.lower().endswith(suffix):
        raise HTTPException(status_code=415, detail=f"Only a {suffix} file can be imported.")

    data = await file.read(_MAX_BYTES + 1)
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="That file is larger than 25 MB.")
    return name, data


def draft_from_bytes(data: bytes, name: str, *, job_id: str = "job") -> ParsedDraft:
    """Read a stored .docx or .pdf the same way the direct parse routes do."""
    draft: ParsedDraft | None = None
    for item in iter_draft_from_bytes(data, name, job_id=job_id):
        if isinstance(item, ParsedDraft):
            draft = item
    if draft is None:
        raise HTTPException(status_code=422, detail="That document has no text to import.")
    return draft


def iter_draft_from_bytes(
    data: bytes,
    name: str,
    *,
    job_id: str,
) -> Iterator[ProgressEvent | ParsedDraft]:
    """Yield stage events, then the draft. Used by the SSE ingest path."""
    if name.lower().endswith(".pdf"):
        if not data.startswith(b"%PDF"):
            raise HTTPException(status_code=422, detail="That file is not a valid PDF.")
        yield from _iter_finish(parse_pdf, data, name, "parse.pdf", job_id=job_id)
        return
    if not data.startswith(b"PK"):
        raise HTTPException(status_code=422, detail="That file is not a valid Word document.")
    yield from _iter_finish(parse_docx, data, name, "parse.docx", job_id=job_id)


def _finish(
    parse: Callable[[bytes, str], ParsedDraft],
    data: bytes,
    name: str,
    event: str,
) -> ParsedDraft:
    return draft_from_bytes(data, name, job_id=event)


def _iter_finish(
    parse: Callable[[bytes, str], ParsedDraft],
    data: bytes,
    name: str,
    event: str,
    *,
    job_id: str,
) -> Iterator[ProgressEvent | ParsedDraft]:
    clock = StageClock(job_id)
    timings: list[dict[str, object]] = []

    def record(item: ProgressEvent) -> ProgressEvent:
        if item.durationMs is not None:
            timings.append(
                {"stage": item.stage, "durationMs": item.durationMs, "detail": item.detail}
            )
        return item

    yield clock.start("parsing", detail="Reading the document", progress=0.08)
    try:
        draft = parse(data, name)
    except (DocxError, PdfError) as exc:
        yield record(clock.finish("parsing", "failed", detail=str(exc), progress=0.08))
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    yield record(clock.finish("parsing", "succeeded", detail=name, progress=0.28))

    yield clock.start("segmenting", detail="Mapping headings", progress=0.32)
    yield record(clock.finish("segmenting", "succeeded", detail="Sections ready", progress=0.4))

    ai = get_ai_settings()
    yield clock.start("extracting", detail="Structuring the article", progress=0.45)
    draft = structure_draft(
        draft,
        api_key=ai.api_key,
        model=ai.model,
        base_url=ai.base_url,
    )
    yield record(
        clock.finish("extracting", "succeeded", detail=draft.title or name, progress=0.82)
    )

    yield clock.start("validating", detail="Checking the draft", progress=0.88)
    if draft.readingNotes:
        overview = f"{draft.overview}\n\n{draft.readingNotes}".strip()
        draft = draft.model_copy(update={"overview": overview, "readingNotes": ""})
    if not draft.title.strip():
        yield record(
            clock.finish(
                "validating",
                "failed",
                detail="That document has no text to import.",
                progress=0.88,
            )
        )
        raise HTTPException(status_code=422, detail="That document has no text to import.")
    yield record(clock.finish("validating", "succeeded", detail="Draft ready", progress=0.96))

    total_ms = sum(int(item["durationMs"]) for item in timings)
    log.info(
        "ingest.trace",
        job_id=job_id,
        filename=name,
        bytes=len(data),
        title=draft.title,
        total_ms=total_ms,
        stages=timings,
    )
    log.info(event, filename=name, bytes=len(data), title=draft.title)
    yield draft
