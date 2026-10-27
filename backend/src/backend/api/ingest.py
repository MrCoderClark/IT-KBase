"""POST /v1/uploads/presign and POST /ingest — a stored file becomes a draft."""

from __future__ import annotations

import json
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from auth_py import Principal
from backend.api.parse import draft_from_bytes, iter_draft_from_bytes
from backend.parse.models import ParsedDraft
from backend.progress import ProgressEvent, event
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

    @router.post("/ingest")
    async def ingest(
        body: IngestBody,
        request: Request,
        principal: Principal = get_principal,
    ):
        _require_importer(principal)
        kind = f".{body.sourceKind}"
        if body.sourceKind not in {"docx", "pdf"} or _suffix(body.fileName) != kind:
            raise HTTPException(status_code=422, detail="Only a .docx or .pdf file can be imported.")
        if not key_owned(body.s3Key, principal.user_id or "user"):
            raise HTTPException(status_code=422, detail="That file is not in storage.")

        wants_stream = "text/event-stream" in (request.headers.get("accept") or "")
        if wants_stream:
            return StreamingResponse(
                _ingest_stream(body),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                },
            )

        draft = _read_draft(body)
        log.info("ingest.read", job_id=body.jobId, key=body.s3Key, title=draft.title)
        return IngestResult(jobId=body.jobId, draft=draft)

    return router


def _ingest_stream(body: IngestBody) -> Iterator[str]:
    try:
        data = download_object(body.s3Key)
    except StorageError as exc:
        fail = event(body.jobId, "parsing", "failed", detail=str(exc), progress=0)
        yield _sse("progress", fail.model_dump())
        yield _sse("failed", {"jobId": body.jobId, "code": "storage", "message": str(exc)})
        return

    if len(data) > _MAX_BYTES:
        message = "That file is larger than 25 MB."
        yield _sse("failed", {"jobId": body.jobId, "code": "too_large", "message": message})
        return

    stages: list[dict] = []
    try:
        for item in iter_draft_from_bytes(data, body.fileName, job_id=body.jobId):
            if isinstance(item, ProgressEvent):
                payload = item.model_dump()
                if item.durationMs is not None:
                    stages.append(
                        {
                            "stage": item.stage,
                            "durationMs": item.durationMs,
                            "detail": item.detail,
                        }
                    )
                yield _sse("progress", payload)
                continue
            log.info("ingest.read", job_id=body.jobId, key=body.s3Key, title=item.title)
            yield _sse(
                "done",
                {
                    "jobId": body.jobId,
                    "draft": item.model_dump(),
                    "trace": {
                        "stages": stages,
                        "totalMs": sum(int(row["durationMs"]) for row in stages),
                    },
                },
            )
            return
    except HTTPException as exc:
        message = str(exc.detail) if isinstance(exc.detail, str) else "The document could not be read."
        yield _sse("failed", {"jobId": body.jobId, "code": "parse", "message": message})
        return
    except Exception as exc:  # noqa: BLE001
        yield _sse("failed", {"jobId": body.jobId, "code": "parse", "message": str(exc)})
        return

    yield _sse(
        "failed",
        {"jobId": body.jobId, "code": "parse", "message": "That document has no text to import."},
    )


def _read_draft(body: IngestBody) -> ParsedDraft:
    try:
        data = download_object(body.s3Key)
    except StorageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="That file is larger than 25 MB.")
    return draft_from_bytes(data, body.fileName, job_id=body.jobId)


def _sse(event_name: str, data: dict) -> str:
    return f"event: {event_name}\ndata: {json.dumps(data, default=str)}\n\n"


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
