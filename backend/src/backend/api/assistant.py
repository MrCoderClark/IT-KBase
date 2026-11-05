"""POST /assistant/embed — vectors for AI Assistant retrieval (spec 20 §5.2, §7.2).

Callers: the Next BFF embeds a user's question (user assertion), and the ingest
worker embeds article chunks (service token). Input text is never logged.
"""

from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from opentelemetry.trace import Status, StatusCode
from pydantic import BaseModel, Field

from auth_py import Principal
from backend.assistant.embeddings import EmbeddingError, get_embedder
from backend.policy import can
from backend.telemetry import get_logger, get_tracer

log = get_logger(__name__)

_MAX_INPUTS = 64
_MAX_CHARS = 8_000


class EmbedBody(BaseModel):
    inputs: list[Annotated[str, Field(min_length=1, max_length=_MAX_CHARS)]] = Field(
        min_length=1, max_length=_MAX_INPUTS
    )


class EmbedResult(BaseModel):
    model: str
    dimensions: int
    embeddings: list[list[float]]
    promptTokens: int


def build_assistant_router(dependency) -> APIRouter:
    router = APIRouter(tags=["assistant"])
    get_principal = Depends(dependency)

    @router.post("/assistant/embed", response_model=EmbedResult)
    async def embed(body: EmbedBody, principal: Principal = get_principal) -> EmbedResult:
        _require_reader_or_service(principal)
        embedder = get_embedder()
        if embedder is None:
            raise HTTPException(status_code=503, detail="The AI Assistant is not configured.")

        with get_tracer().start_as_current_span(
            "assistant.embed",
            attributes={"tb.inputs": len(body.inputs), "tb.model": embedder.model},
        ) as span:
            try:
                result = await asyncio.to_thread(embedder.embed, list(body.inputs))
            except EmbeddingError as exc:
                span.set_status(Status(StatusCode.ERROR, str(exc)))
                log.warning("assistant.embed.failed", inputs=len(body.inputs), error=str(exc))
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            span.set_attribute("tb.tokens_in", result.prompt_tokens)

        log.info(
            "assistant.embed",
            inputs=len(body.inputs),
            tokens=result.prompt_tokens,
            model=embedder.model,
            caller=principal.kind,
        )
        return EmbedResult(
            model=embedder.model,
            dimensions=embedder.dimensions,
            embeddings=result.vectors,
            promptTokens=result.prompt_tokens,
        )

    return router


def _require_reader_or_service(principal: Principal) -> None:
    if principal.kind == "service":
        return
    if not can(principal.role, "article.read"):
        raise HTTPException(status_code=403, detail="You do not have permission to do that.")
