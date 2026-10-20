"""POST /v1/parse/docx — Word parse, then an Overview when the file has none."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from auth_py import Principal
from backend.config import get_ai_settings
from backend.parse.docx import DocxError, parse_docx
from backend.parse.models import ParsedDraft
from backend.parse.overview import fill_overview
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
        if principal.kind != "user" or principal.role not in {"author", "reviewer", "admin"}:
            raise HTTPException(status_code=403, detail="You cannot import articles.")

        name = (file.filename or "document.docx").rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        if not name.lower().endswith(".docx"):
            raise HTTPException(
                status_code=415,
                detail="Only a .docx file can be imported. PDF comes later.",
            )

        data = await file.read(_MAX_BYTES + 1)
        if len(data) > _MAX_BYTES:
            raise HTTPException(status_code=413, detail="That file is larger than 25 MB.")
        if len(data) < 4 or data[:2] != b"PK":
            raise HTTPException(status_code=422, detail="That file is not a Word document.")

        try:
            draft = parse_docx(data, name)
        except DocxError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        ai = get_ai_settings()
        draft = fill_overview(
            draft,
            api_key=ai.api_key,
            model=ai.model,
            base_url=ai.base_url,
        )
        log.info("docx.parsed", filename=name, bytes=len(data), title=draft.title)
        return draft

    return router
