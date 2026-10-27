"""Stage events for an ingest job. The browser stepper reads these over SSE."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field

Stage = Literal["parsing", "segmenting", "extracting", "validating", "done"]
Status = Literal["started", "succeeded", "failed"]


class ProgressEvent(BaseModel):
    jobId: str
    ts: str = Field(default_factory=lambda: datetime.now(UTC).isoformat().replace("+00:00", "Z"))
    stage: Stage
    status: Status
    detail: str = ""
    progress: float = Field(ge=0, le=1, default=0)


def event(
    job_id: str,
    stage: Stage,
    status: Status,
    *,
    detail: str = "",
    progress: float = 0,
) -> ProgressEvent:
    return ProgressEvent(
        jobId=job_id,
        stage=stage,
        status=status,
        detail=detail,
        progress=progress,
    )
