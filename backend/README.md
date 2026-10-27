# TechBase Ingestion Service

Python 3.12 + FastAPI service that parses DOCX/PDF uploads into structured
knowledge articles. See `Docs/specs/05-ai-ingestion.md` and
`Docs/specs/06-api.md` for the full contract.

This README documents the local dev loop. For architecture, read the specs.

## Prerequisites

- Python 3.12 (pinned in `.python-version`)
- [uv](https://docs.astral.sh/uv/) for dependency and env management

## First-time setup

From the `backend/` directory:

```powershell
uv sync
```

That installs runtime deps + dev deps into `.venv/` based on `pyproject.toml`
and `uv.lock`.

## Run the service (local dev)

```powershell
uv run backend
```

Equivalent, if you want uvicorn's flags directly:

```powershell
uv run uvicorn backend.app:app --host 127.0.0.1 --port 8080 --reload
```

Smoke-test it:

```powershell
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/readyz
```

Interactive OpenAPI UI: <http://127.0.0.1:8080/docs>

## Tests

```powershell
uv run pytest
```

Expected: 4 passing tests (healthz, readyz, openapi, docs).

## Lint + format

```powershell
uv run ruff check .
uv run ruff format .
```

CI will fail on either. `ruff format` is the autofixer; `ruff check --fix` can
auto-apply some lint fixes.

## Configuration

All env vars are prefixed `TB_` and loaded by Pydantic Settings. A `.env` file
in the current working directory is picked up in dev. See
`src/backend/config.py` for the full list and defaults.

| Env var          | Default               | Notes                                       |
|------------------|-----------------------|---------------------------------------------|
| `TB_ENV`         | `local`               | `local` \| `preview` \| `staging` \| `prod` |
| `TB_HOST`        | `127.0.0.1`           |                                             |
| `TB_PORT`        | `8080`                |                                             |
| `TB_RELOAD`      | `false`               | `main()` sets this true for `uv run backend` |
| `TB_LOG_LEVEL`   | `INFO`                | `DEBUG` \| `INFO` \| `WARNING` \| `ERROR`   |
| `TB_DOCS_ENABLED`| `true`                | Set `false` in prod to hide /docs           |
| `TB_S3_ENDPOINT` | empty                 | S3-compatible URL, path-style (SeaweedFS or MinIO) |
| `TB_S3_BUCKET`   | empty                 | Upload bucket. Empty storage refuses an import with a clear error |
| `TB_S3_REGION`   | `us-east-1`           |                                             |
| `TB_S3_ACCESS_KEY` | empty               |                                             |
| `TB_S3_SECRET_KEY` | empty               |                                             |

The browser PUTs the file, so the bucket has to allow this site (`Access-Control-Allow-Origin` for the Next origin, method `PUT`, and the `Content-Type` header). Restart this process after changing `.env`. Restarting Next.js does not reload it.

## Layout

```
backend/
├─ src/backend/
│  ├─ __init__.py         # main() → uvicorn runner (dev convenience)
│  ├─ app.py              # create_app() + module-level `app`
│  ├─ config.py           # Pydantic Settings
│  ├─ telemetry.py        # structlog JSON logging
│  └─ api/
│     ├─ __init__.py
│     └─ health.py        # /healthz, /readyz
├─ tests/
│  ├─ conftest.py         # TestClient fixture
│  └─ test_health.py
└─ pyproject.toml
```
