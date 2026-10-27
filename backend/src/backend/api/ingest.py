"""POST /v1/uploads/presign and POST /ingest — a stored file becomes a draft."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth_py import Principal
from backend.api.parse import draft_from_bytes
from backend.parse.models import ParsedDraft
from backend.storage import StorageError, download_object, key_owned, object_key, presign_put
from backend.telemetry import get_logger

log = get_logger(__name__)

_MAX_BYTES = 25 * 1024 * 1024
_ROLES = {"author", "reviewer", "admin"}


class PresignBody(BaseModel):
    fileName: str = Field(min_length=1, max_length=180)
    contentType: str = Field(min_length=1, max_length=120)
    sizeBytes: int = Field(ge=1, le=_MAX_BYTES)


class PresignResult(BaseModel):
    key: str
    url: str
    headers: dict[str, str]


class IngestBody(BaseModel):
    jobId: str = Field(min_length=1, max_length=80)
    s3Key: str = Field(min_length=1, max_length=500)
    fileName: str = Field(min_length=1, max_length=180)
    sourceKind: str
    sizeBytes: int = Field(ge=1, le=_MAX_BYTES)


class IngestResult(BaseModel):
    jobId: str
    draft: ParsedDraft


def build_ingest_router(dependency) -> APIRouter:
    router = APIRouter(tags=["ingest"])
    get_principal = Depends(dependency)

    @router.post("/v1/uploads/presign", response_model=PresignResult)
    async def presign(body: PresignBody, principal: Principal = get_principal) -> PresignResult:
        _require_importer(principal)
        suffix = _suffix(body.fileName)
        key = object_key(principal.user_id or "user", body.fileName)
        try:
            url, headers = presign_put(key, _content_type(suffix))
        except StorageError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        return PresignResult(key=key, url=url, headers=headers)

    @router.post("/ingest", response_model=IngestResult)
    async def ingest(body: IngestBody, principal: Principal = get_principal) -> IngestResult:
        _require_importer(principal)
        kind = f".{body.sourceKind}"
        if body.sourceKind not in {"docx", "pdf"} or _suffix(body.fileName) != kind:
            raise HTTPException(status_code=422, detail="Only a .docx or .pdf file can be imported.")
        if not key_owned(body.s3Key, principal.user_id or "user"):
            raise HTTPException(status_code=422, detail="That file is not in storage.")
        try:
            data = download_object(body.s3Key)
        except StorageError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if len(data) > _MAX_BYTES:
            raise HTTPException(status_code=413, detail="That file is larger than 25 MB.")
        draft = draft_from_bytes(data, body.fileName)
        log.info("ingest.read", job_id=body.jobId, key=body.s3Key, title=draft.title)
        return IngestResult(jobId=body.jobId, draft=draft)

    return router


def _require_importer(principal: Principal) -> None:
    if principal.kind != "user" or principal.role not in _ROLES:
        raise HTTPException(status_code=403, detail="You cannot import articles.")


def _suffix(name: str) -> str:
    lower = name.lower()
    if lower.endswith(".docx"):
        return ".docx"
    if lower.endswith(".pdf"):
        return ".pdf"
    raise HTTPException(status_code=415, detail="Only a .docx or .pdf file can be imported.")


def _content_type(suffix: str) -> str:
    if suffix == ".pdf":
        return "application/pdf"
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
