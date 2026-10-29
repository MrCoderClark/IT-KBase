"""Write FastAPI /openapi.json for the frontend type generator.

Usage (from backend/):

    uv run python scripts/export_openapi.py

Writes ../../frontend/lib/api/openapi.json (repo paths).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow `uv run python scripts/export_openapi.py` without installing as a module.
_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from backend.app import app  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "lib" / "api" / "openapi.json"


def main() -> None:
    schema = app.openapi()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
