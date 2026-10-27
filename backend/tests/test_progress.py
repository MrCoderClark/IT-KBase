"""Stage clock records how long each ingest step took."""

from backend.progress import StageClock


def test_stage_clock_records_duration() -> None:
    clock = StageClock("job1")
    started = clock.start("parsing", detail="Reading", progress=0.1)
    assert started.status == "started"
    assert started.durationMs is None

    finished = clock.finish("parsing", "succeeded", detail="ok", progress=0.3)
    assert finished.status == "succeeded"
    assert finished.durationMs is not None
    assert finished.durationMs >= 0
