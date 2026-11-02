"""Ingestion artifact bundles (spec 05 §5) — S3 JSON + source copy, 7-day expiry."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime, timedelta
from typing import Any

from pydantic import BaseModel, Field

from backend.parse.models import ParsedDraft
from backend.storage import StorageError, download_object, object_exists, put_object
from backend.telemetry import get_logger

log = get_logger(__name__)

_ARTIFACT_TTL_DAYS = 7
_SAFE_JOB = re.compile(r"[^\w.\-]+")


class ArtifactBundle(BaseModel):
    """Reproducible record of one ingest run."""

    jobId: str
    createdAt: str
    expiresAt: str
    fileName: str
    sourceKind: str
    sourceKey: str | None = None
    rawDoc: dict[str, Any]
    normDoc: dict[str, Any]
    segments: list[dict[str, Any]] = Field(default_factory=list)
    llm: dict[str, Any] | None = None
    draftProto: dict[str, Any]
    draft: dict[str, Any]
    timings: list[dict[str, Any]] = Field(default_factory=list)


def artifact_prefix(job_id: str, when: datetime | None = None) -> str:
    stamp = when or datetime.now(UTC)
    safe = _SAFE_JOB.sub("", job_id).strip() or "job"
    return f"uploads/{stamp.year:04d}/{stamp.month:02d}/{safe}"


def artifact_json_key(job_id: str, when: datetime | None = None) -> str:
    return f"{artifact_prefix(job_id, when)}/artifact.json"


def source_object_key(job_id: str, file_name: str, when: datetime | None = None) -> str:
    lower = file_name.lower()
    suffix = ".pdf" if lower.endswith(".pdf") else ".docx"
    return f"{artifact_prefix(job_id, when)}/source{suffix}"


def segments_from_draft(draft: ParsedDraft) -> list[dict[str, Any]]:
    """Prefer the segmenter output; fall back to folding the parsed draft."""
    if draft.ingestSegments:
        return list(draft.ingestSegments)
    segments: list[dict[str, Any]] = []
    if draft.overview.strip():
        segments.append(
            {
                "title": draft.overviewTitle or "Overview",
                "headingLevel": 1,
                "candidateKind": "overview",
                "blocks": [{"type": "text", "text": draft.overview}],
            }
        )
    if draft.prerequisites:
        segments.append(
            {
                "title": draft.prerequisitesTitle or "Prerequisites",
                "headingLevel": 1,
                "candidateKind": "prerequisites",
                "blocks": [{"type": "text", "text": "\n".join(draft.prerequisites)}],
            }
        )
    if draft.steps:
        segments.append(
            {
                "title": draft.stepsTitle or "Step-by-Step Instructions",
                "headingLevel": 1,
                "candidateKind": "steps",
                "blocks": [
                    {
                        "type": "text",
                        "text": f"{step.title}\n{step.body}".strip(),
                        "images": list(step.images),
                    }
                    for step in draft.steps
                ],
            }
        )
    if draft.verification or draft.verificationCode.strip():
        segments.append(
            {
                "title": draft.verificationTitle or "Verification",
                "headingLevel": 1,
                "candidateKind": "verification",
                "blocks": [
                    {"type": "text", "text": "\n".join(draft.verification)},
                    *(
                        [{"type": "code", "text": draft.verificationCode}]
                        if draft.verificationCode.strip()
                        else []
                    ),
                ],
            }
        )
    if draft.troubleshooting:
        segments.append(
            {
                "title": draft.troubleshootingTitle or "Troubleshooting",
                "headingLevel": 1,
                "candidateKind": "troubleshooting",
                "blocks": [
                    {"type": "text", "text": f"{item.title}\n{item.body}".strip()}
                    for item in draft.troubleshooting
                ],
            }
        )
    return segments


def build_bundle(
    *,
    job_id: str,
    file_name: str,
    data: bytes,
    parser_draft: ParsedDraft,
    draft_proto: ParsedDraft,
    final_draft: ParsedDraft,
    timings: list[dict[str, Any]],
    llm: dict[str, Any] | None,
    source_key: str | None = None,
    when: datetime | None = None,
) -> ArtifactBundle:
    stamp = when or datetime.now(UTC)
    expires = stamp + timedelta(days=_ARTIFACT_TTL_DAYS)
    lower = file_name.lower()
    kind = "pdf" if lower.endswith(".pdf") else "docx"
    source_key_path = source_object_key(job_id, file_name, stamp)
    digest = hashlib.sha256(data).hexdigest()
    return ArtifactBundle(
        jobId=job_id,
        createdAt=stamp.isoformat().replace("+00:00", "Z"),
        expiresAt=expires.isoformat().replace("+00:00", "Z"),
        fileName=file_name,
        sourceKind=kind,
        sourceKey=source_key,
        rawDoc={
            "sha256": digest,
            "bytes": len(data),
            "objectKey": source_key_path,
            "contentType": (
                "application/pdf"
                if kind == "pdf"
                else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ),
        },
        normDoc=parser_draft.model_dump(),
        segments=segments_from_draft(parser_draft),
        llm=llm,
        draftProto=draft_proto.model_dump(),
        draft=final_draft.model_dump(),
        timings=list(timings),
    )


def write_artifact_bundle(bundle: ArtifactBundle, data: bytes) -> str | None:
    """Persist source bytes + artifact.json. Returns the JSON key, or None if storage is off."""
    raw_key = str(bundle.rawDoc.get("objectKey") or "")
    json_key = artifact_json_key(bundle.jobId, datetime.fromisoformat(bundle.createdAt.replace("Z", "+00:00")))
    content_type = str(bundle.rawDoc.get("contentType") or "application/octet-stream")
    try:
        put_object(
            raw_key,
            data,
            content_type,
            expires_in_days=_ARTIFACT_TTL_DAYS,
        )
        put_object(
            json_key,
            json.dumps(bundle.model_dump(), ensure_ascii=False, indent=2).encode("utf-8"),
            "application/json",
            expires_in_days=_ARTIFACT_TTL_DAYS,
        )
    except StorageError as exc:
        log.warning("artifact.write_skipped", job_id=bundle.jobId, error=str(exc))
        return None
    log.info("artifact.written", job_id=bundle.jobId, key=json_key)
    return json_key


def load_artifact(job_id: str) -> tuple[ArtifactBundle, bytes]:
    """Load artifact.json + source bytes for replay."""
    json_key = find_artifact_key(job_id)
    payload = json.loads(download_object(json_key).decode("utf-8"))
    bundle = ArtifactBundle.model_validate(payload)
    raw_key = str(bundle.rawDoc.get("objectKey") or "")
    if not raw_key:
        raise StorageError("That artifact has no source object.")
    return bundle, download_object(raw_key)


def find_artifact_key(job_id: str) -> str:
    """Look up artifact.json for a job id (current month, then prior months)."""
    now = datetime.now(UTC)
    for months_ago in range(0, 14):
        year = now.year
        month = now.month - months_ago
        while month <= 0:
            month += 12
            year -= 1
        key = artifact_json_key(job_id, datetime(year, month, 1, tzinfo=UTC))
        try:
            if object_exists(key):
                return key
        except StorageError:
            continue
    raise StorageError(f"No artifact found for job {job_id}.")
