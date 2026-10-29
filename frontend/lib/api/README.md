# Ingestion API types

Pydantic on the Python service is the source of truth.

1. From `backend/`: `uv run python scripts/export_openapi.py`  
   → writes `openapi.json` here.
2. From `frontend/`: `pnpm gen:types`  
   → writes `generated/ingestion.ts` via `openapi-typescript`.

Import schemas from `@/lib/api/generated/ingestion` (or re-exports in
`@/lib/ingestion/to-draft`). Do not hand-edit `generated/` or `openapi.json`.
