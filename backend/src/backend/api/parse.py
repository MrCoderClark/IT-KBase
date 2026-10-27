"""POST /v1/parse/docx and /v1/parse/pdf — a file becomes a draft."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from auth_py import Principal
from backend.config import get_ai_settings
from backend.parse.docx import DocxError, parse_docx
from backend.parse.models import ParsedDraft
from backend.parse.overview import structure_draft
from backend.parse.pdf import PdfError, parse_pdf
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


def _finish(
    parse: Callable[[bytes, str], ParsedDraft],
    data: bytes,
    name: str,
    event: str,
) -> ParsedDraft:
    try:
        draft = parse(data, name)
    except (DocxError, PdfError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    ai = get_ai_settings()
    draft = structure_draft(
        draft,
        api_key=ai.api_key,
        model=ai.model,
        base_url=ai.base_url,
    )
    if draft.readingNotes:
        overview = f"{draft.overview}\n\n{draft.readingNotes}".strip()
        draft = draft.model_copy(update={"overview": overview, "readingNotes": ""})
    log.info(event, filename=name, bytes=len(data), title=draft.title)
    return draft
