"""TechBase ingestion service — Python package entrypoint.

The `main()` function is wired as a console script in `pyproject.toml`
(`[project.scripts]` → `backend = "backend:main"`), so `uv run backend`
launches the API with hot reload for local development.

For production, run uvicorn (or a process manager) against
`backend.app:app` directly rather than through this entrypoint.
"""

from __future__ import annotations


def main() -> None:
    """Launch the FastAPI app with uvicorn (dev-only convenience)."""
    import uvicorn

    from backend.config import get_settings

    settings = get_settings()
    uvicorn.run(
        "backend.app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
    )
