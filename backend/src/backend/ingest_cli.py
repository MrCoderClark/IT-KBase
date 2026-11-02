"""CLI for ingestion helpers — `uv run ingest replay <jobId>`."""

from __future__ import annotations

import argparse
import json
import sys

from backend.api.parse import draft_from_bytes
from backend.artifacts import load_artifact
from backend.extractors import FakeExtractor, get_extractor
from backend.storage import StorageError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ingest", description="TechBase ingestion helpers")
    sub = parser.add_subparsers(dest="command", required=True)

    replay = sub.add_parser(
        "replay",
        help="Re-run parse+extract from a stored artifact bundle (spec 05 §5)",
    )
    replay.add_argument("job_id", help="Ingestion job id used when the artifact was written")
    replay.add_argument(
        "--fake",
        action="store_true",
        help="Use FakeExtractor instead of the configured AI host",
    )
    replay.add_argument(
        "--json",
        action="store_true",
        help="Print the draft as JSON",
    )

    args = parser.parse_args(argv)
    if args.command == "replay":
        return _replay(args.job_id, fake=args.fake, as_json=args.json)
    parser.error(f"Unknown command {args.command}")
    return 2


def _replay(job_id: str, *, fake: bool, as_json: bool) -> int:
    try:
        bundle, data = load_artifact(job_id)
    except StorageError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    extractor = FakeExtractor() if fake else get_extractor()
    draft = draft_from_bytes(
        data,
        bundle.fileName,
        job_id=f"replay-{job_id}",
        source_key=bundle.sourceKey,
        extractor=extractor,
        persist_artifact=False,
    )

    if as_json:
        print(json.dumps(draft.model_dump(), indent=2, ensure_ascii=False))
    else:
        print(f"jobId={job_id}")
        print(f"title={draft.title}")
        print(f"steps={len(draft.steps)}")
        print(f"summary={draft.summary[:120]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
