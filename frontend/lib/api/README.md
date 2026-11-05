# Ingestion API types

Pydantic on the Python service is the source of truth. `generated/ingestion.ts`
and `openapi.json` are **generated** — never hand-edit them. Import schemas from
`@/lib/api/generated/ingestion` (or the re-exports in `@/lib/ingestion/to-draft`).

## When to regenerate

Regenerate **whenever you change the API surface** of the FastAPI service:

- add, remove, or rename a route;
- change a request or response Pydantic model (fields, types, defaults, limits).

You do **not** need to regenerate for logic-only changes that leave the schema
untouched (e.g. a new ranking formula, an internal helper).

## How (run both, in this order)

```powershell
# 1. dump the schema from the live Pydantic app → frontend/lib/api/openapi.json
cd backend
uv run python scripts/export_openapi.py
cd ..

# 2. regenerate the TS client from it → frontend/lib/api/generated/ingestion.ts
cd frontend
pnpm gen:types
cd ..
```

Then **commit both generated files** with your change:

```powershell
git add frontend/lib/api/openapi.json frontend/lib/api/generated/ingestion.ts
```

## CI enforces this

The `OpenAPI types` CI job runs exactly the two commands above and then
`git diff --exit-code` on both files. If your branch's generated files don't
match a fresh regen, the check fails. Two common ways to trip it:

- running `pnpm gen:types` **without** `export_openapi.py` first → `ingestion.ts`
  is regenerated from a stale `openapi.json`;
- committing the backend change but forgetting to `git add` the two generated
  files.

So: change a route or model → regenerate → commit both files → push. (A
`pre-push` git hook can reproduce this check locally; ask if you want it wired.)
