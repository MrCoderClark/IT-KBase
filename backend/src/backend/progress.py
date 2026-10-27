"""Stage events for an ingest job. The browser stepper reads these over SSE."""

from __future__ import annotations

import time
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
    durationMs: int | None = None


def event(
    job_id: str,
    stage: Stage,
    status: Status,
    *,
    detail: str = "",
    progress: float = 0,
    duration_ms: int | None = None,
) -> ProgressEvent:
    return ProgressEvent(
        jobId=job_id,
        stage=stage,
        status=status,
        detail=detail,
        progress=progress,
        durationMs=duration_ms,
    )


class StageClock:
    """Times each stage from started to succeeded/failed."""

    def __init__(self, job_id: str) -> None:
        self.job_id = job_id
        self._started: dict[str, float] = {}

    def start(self, stage: Stage, *, detail: str = "", progress: float = 0) -> ProgressEvent:
        self._started[stage] = time.perf_counter()
        return event(self.job_id, stage, "started", detail=detail, progress=progress)

    def finish(
        self,
        stage: Stage,
        status: Status,
        *,
        detail: str = "",
        progress: float = 0,
    ) -> ProgressEvent:
        began = self._started.pop(stage, None)
        duration_ms = int((time.perf_counter() - began) * 1000) if began is not None else 0
        return event(
            self.job_id,
            stage,
            status,
            detail=detail,
            progress=progress,
            duration_ms=max(duration_ms, 0),
        )
