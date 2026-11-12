"""POST /assistant/embed — vectors for AI Assistant retrieval (spec 20 §5.2, §7.2).

Callers: the Next BFF embeds a user's question (user assertion), and the ingest
worker embeds article chunks (service token). Input text is never logged.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Iterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from opentelemetry.trace import Span, Status, StatusCode, set_span_in_context
from pydantic import BaseModel, Field, model_validator

from auth_py import Principal
from backend.assistant.answerer import (
    AnswerError,
    AnswerMode,
    BundleChunk,
    DoneEvent,
    KBAnswerer,
    TokenEvent,
    Turn,
    get_answerer,
)
from backend.assistant.drafter import (
    DraftError,
    DraftMode,
    DraftRequest,
    TaxonomyOption,
    TidyRequest,
    get_drafter,
)
from backend.assistant.embeddings import EmbeddingError, get_embedder
from backend.parse.models import ParsedDraft
from backend.policy import can, require_capability
from backend.telemetry import get_logger, get_tracer, iter_with_context

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


class AnswerBody(BaseModel):
    question: Annotated[str, Field(min_length=1, max_length=4_000)]
    bundle: Annotated[list[BundleChunk], Field(max_length=24)] = []
    history: Annotated[list[Turn], Field(max_length=10)] = []
    mode: AnswerMode = "answer"


class DraftBody(BaseModel):
    mode: DraftMode = "notes"
    notes: Annotated[str, Field(max_length=16_000)] = ""
    prompt: Annotated[str, Field(max_length=2_000)] = ""
    categories: Annotated[list[str], Field(max_length=60)] = []
    tags: Annotated[list[str], Field(max_length=120)] = []

    @model_validator(mode="after")
    def _require_input(self) -> DraftBody:
        if self.mode == "notes" and not self.notes.strip():
            raise ValueError("notes is required for mode 'notes'")
        if self.mode == "prompt" and not self.prompt.strip():
            raise ValueError("prompt is required for mode 'prompt'")
        return self


class DraftResult(BaseModel):
    draft: ParsedDraft


class TaxonomyOpt(BaseModel):
    slug: str
    name: str


class TidyBody(BaseModel):
    content: Annotated[str, Field(min_length=1, max_length=24_000)]
    categories: Annotated[list[TaxonomyOpt], Field(max_length=200)] = []
    tags: Annotated[list[TaxonomyOpt], Field(max_length=500)] = []


class TidyResponse(BaseModel):
    draft: ParsedDraft
    categorySlug: str | None = None
    tagSlugs: list[str] = []


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

    @router.post("/assistant/answer")
    async def answer(body: AnswerBody, principal: Principal = get_principal) -> StreamingResponse:
        _require_reader_or_service(principal)
        answerer = get_answerer()
        if answerer is None:
            raise HTTPException(status_code=503, detail="The AI Assistant is not configured.")
        return StreamingResponse(_answer_stream(answerer, body), media_type="text/event-stream")

    @router.post("/assistant/draft", response_model=DraftResult)
    async def draft(body: DraftBody, principal: Principal = get_principal) -> DraftResult:
        # Authoring copilot is author+ (spec 20 §3.2); the service token may call it too.
        if principal.kind != "service":
            require_capability(principal, "article.create")
        drafter = get_drafter()
        if drafter is None:
            raise HTTPException(status_code=503, detail="The AI Assistant is not configured.")

        with get_tracer().start_as_current_span(
            "assistant.draft", attributes={"tb.mode": body.mode}
        ) as span:
            draft_request = DraftRequest(
                mode=body.mode,
                notes=body.notes,
                prompt=body.prompt,
                categories=list(body.categories),
                tags=list(body.tags),
            )
            try:
                result = await asyncio.to_thread(drafter.draft, draft_request)
            except DraftError as exc:
                span.set_status(Status(StatusCode.ERROR, str(exc)))
                log.warning("assistant.draft.failed", mode=body.mode, error=str(exc))
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            span.set_attribute("tb.steps", len(result.steps))

        log.info("assistant.draft", mode=body.mode, steps=len(result.steps), caller=principal.kind)
        return DraftResult(draft=result)

    @router.post("/assistant/tidy", response_model=TidyResponse)
    async def tidy(body: TidyBody, principal: Principal = get_principal) -> TidyResponse:
        if principal.kind != "service":
            require_capability(principal, "article.create")
        drafter = get_drafter()
        if drafter is None:
            raise HTTPException(status_code=503, detail="The AI Assistant is not configured.")

        tidy_request = TidyRequest(
            content=body.content,
            categories=[TaxonomyOption(slug=opt.slug, name=opt.name) for opt in body.categories],
            tags=[TaxonomyOption(slug=opt.slug, name=opt.name) for opt in body.tags],
        )
        with get_tracer().start_as_current_span("assistant.tidy") as span:
            try:
                result = await asyncio.to_thread(drafter.tidy, tidy_request)
            except DraftError as exc:
                span.set_status(Status(StatusCode.ERROR, str(exc)))
                log.warning("assistant.tidy.failed", error=str(exc))
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            span.set_attribute("tb.steps", len(result.draft.steps))

        log.info("assistant.tidy", steps=len(result.draft.steps), caller=principal.kind)
        return TidyResponse(
            draft=result.draft,
            categorySlug=result.category_slug,
            tagSlugs=result.tag_slugs,
        )

    return router


def _answer_stream(answerer: KBAnswerer, body: AnswerBody) -> Iterator[str]:
    span = get_tracer().start_span(
        "assistant.answer",
        attributes={"tb.chunks": len(body.bundle), "tb.mode": body.mode},
    )
    try:
        # One span per stream, attached once around all yields, detached once after —
        # the ingest `Failed to detach context` lesson (spec 19, §5.5).
        yield from iter_with_context(_answer_events(answerer, body, span), set_span_in_context(span))
    finally:
        span.end()


def _answer_events(answerer: KBAnswerer, body: AnswerBody, span: Span) -> Iterator[str]:
    try:
        for event in answerer.answer(body.question, body.bundle, body.history, body.mode):
            if isinstance(event, TokenEvent):
                yield _sse("token", {"text": event.text})
            elif isinstance(event, DoneEvent):
                span.set_attribute("tb.citations", len(event.citations))
                span.set_attribute("tb.grounded", event.grounded)
                if event.usage:
                    span.set_attribute("tb.tokens_in", event.usage.get("prompt_tokens", 0))
                    span.set_attribute("tb.tokens_out", event.usage.get("completion_tokens", 0))
                log.info(
                    "assistant.answer",
                    chunks=len(body.bundle),
                    citations=len(event.citations),
                    grounded=event.grounded,
                )
                yield _sse(
                    "done",
                    {
                        "answer": event.answer,
                        "citations": event.citations,
                        "grounded": event.grounded,
                        "usage": event.usage,
                    },
                )
    except AnswerError as exc:
        span.set_status(Status(StatusCode.ERROR, str(exc)))
        # Log the underlying provider error (HTTP status + detail); the user-facing
        # message stays generic.
        log.warning("assistant.answer.failed", error=str(exc), cause=repr(exc.__cause__))
        yield _sse("failed", {"code": "model", "message": str(exc)})


def _sse(event_name: str, data: object) -> str:
    return f"event: {event_name}\ndata: {json.dumps(data, default=str)}\n\n"


def _require_reader_or_service(principal: Principal) -> None:
    if principal.kind == "service":
        return
    if not can(principal.role, "article.read"):
        raise HTTPException(status_code=403, detail="You do not have permission to do that.")
