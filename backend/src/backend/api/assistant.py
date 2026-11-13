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
    UpdateRequest,
    get_drafter,
)
from backend.assistant.embeddings import EmbeddingError, get_embedder
from backend.assistant.review import (
    DiffStatus,
    DiffSummaryRequest,
    FeedbackDigestRequest,
    GapClusteringRequest,
    GapItem,
    ReviewError,
    SectionChange,
    get_reviewer,
)
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


class UpdateDraftBody(BaseModel):
    content: Annotated[str, Field(min_length=1, max_length=24_000)]
    outdated: Annotated[list[Annotated[str, Field(max_length=240)]], Field(max_length=50)] = []


class DiffChange(BaseModel):
    title: Annotated[str, Field(max_length=300)] = ""
    status: DiffStatus
    before: Annotated[str, Field(max_length=4_000)] = ""
    after: Annotated[str, Field(max_length=4_000)] = ""


class DiffSummaryBody(BaseModel):
    title: Annotated[str, Field(max_length=300)] = ""
    fromVersion: Annotated[str, Field(max_length=20)] = ""
    toVersion: Annotated[str, Field(max_length=20)] = ""
    changes: Annotated[list[DiffChange], Field(max_length=60)] = []


class DiffSummaryResponse(BaseModel):
    summary: str
    changes: list[str] = []


class FeedbackDigestBody(BaseModel):
    title: Annotated[str, Field(max_length=300)] = ""
    comments: Annotated[list[Annotated[str, Field(max_length=1_000)]], Field(max_length=200)] = []


class FeedbackDigestResponse(BaseModel):
    summary: str
    themes: list[str] = []
    suggestions: list[str] = []


class GapItemBody(BaseModel):
    id: Annotated[str, Field(max_length=40)]
    question: Annotated[str, Field(max_length=300)] = ""


class ClusterGapsBody(BaseModel):
    gaps: Annotated[list[GapItemBody], Field(max_length=200)] = []


class GapClusterInfo(BaseModel):
    label: str
    theme: str = ""
    gapIds: list[str] = []


class ClusterGapsResponse(BaseModel):
    clusters: list[GapClusterInfo] = []


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

    @router.post("/assistant/update-draft", response_model=DraftResult)
    async def update_draft(
        body: UpdateDraftBody, principal: Principal = get_principal
    ) -> DraftResult:
        # Refreshing an article into a draft is author+ like the other drafters
        # (spec 20 §3.2/§3.3); the service token may call it too.
        if principal.kind != "service":
            require_capability(principal, "article.create")
        drafter = get_drafter()
        if drafter is None:
            raise HTTPException(status_code=503, detail="The AI Assistant is not configured.")

        update_request = UpdateRequest(content=body.content, outdated=list(body.outdated))
        with get_tracer().start_as_current_span(
            "assistant.update_draft", attributes={"tb.flags": len(body.outdated)}
        ) as span:
            try:
                result = await asyncio.to_thread(drafter.update, update_request)
            except DraftError as exc:
                span.set_status(Status(StatusCode.ERROR, str(exc)))
                log.warning("assistant.update_draft.failed", error=str(exc))
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            span.set_attribute("tb.steps", len(result.steps))

        log.info(
            "assistant.update_draft",
            flags=len(body.outdated),
            steps=len(result.steps),
            caller=principal.kind,
        )
        return DraftResult(draft=result)

    @router.post("/assistant/diff-summary", response_model=DiffSummaryResponse)
    async def diff_summary(
        body: DiffSummaryBody, principal: Principal = get_principal
    ) -> DiffSummaryResponse:
        # Version history is reviewer+ (spec 20 §3.3 / canReadArticleHistory); the
        # service token may call it too.
        if principal.kind != "service":
            require_capability(principal, "article.publish")
        reviewer = get_reviewer()
        if reviewer is None:
            raise HTTPException(status_code=503, detail="The AI Assistant is not configured.")

        diff_request = DiffSummaryRequest(
            title=body.title,
            from_version=body.fromVersion,
            to_version=body.toVersion,
            changes=[
                SectionChange(
                    title=change.title,
                    status=change.status,
                    before=change.before,
                    after=change.after,
                )
                for change in body.changes
            ],
        )
        with get_tracer().start_as_current_span(
            "assistant.diff_summary", attributes={"tb.changes": len(body.changes)}
        ) as span:
            try:
                result = await asyncio.to_thread(reviewer.summarize_diff, diff_request)
            except ReviewError as exc:
                span.set_status(Status(StatusCode.ERROR, str(exc)))
                log.warning("assistant.diff_summary.failed", error=str(exc))
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            span.set_attribute("tb.highlights", len(result.changes))

        log.info(
            "assistant.diff_summary",
            changes=len(body.changes),
            highlights=len(result.changes),
            caller=principal.kind,
        )
        return DiffSummaryResponse(summary=result.summary, changes=result.changes)

    @router.post("/assistant/feedback-digest", response_model=FeedbackDigestResponse)
    async def feedback_digest(
        body: FeedbackDigestBody, principal: Principal = get_principal
    ) -> FeedbackDigestResponse:
        # Feedback review is reviewer+ (spec 20 §3.3 / canReviewArticleFeedback); the
        # service token may call it too.
        if principal.kind != "service":
            require_capability(principal, "article.publish")
        reviewer = get_reviewer()
        if reviewer is None:
            raise HTTPException(status_code=503, detail="The AI Assistant is not configured.")

        digest_request = FeedbackDigestRequest(title=body.title, comments=list(body.comments))
        with get_tracer().start_as_current_span(
            "assistant.feedback_digest", attributes={"tb.comments": len(body.comments)}
        ) as span:
            try:
                result = await asyncio.to_thread(reviewer.digest_feedback, digest_request)
            except ReviewError as exc:
                span.set_status(Status(StatusCode.ERROR, str(exc)))
                log.warning("assistant.feedback_digest.failed", error=str(exc))
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            span.set_attribute("tb.themes", len(result.themes))

        log.info(
            "assistant.feedback_digest",
            comments=len(body.comments),
            themes=len(result.themes),
            caller=principal.kind,
        )
        return FeedbackDigestResponse(
            summary=result.summary, themes=result.themes, suggestions=result.suggestions
        )

    @router.post("/assistant/cluster-gaps", response_model=ClusterGapsResponse)
    async def cluster_gaps(
        body: ClusterGapsBody, principal: Principal = get_principal
    ) -> ClusterGapsResponse:
        # Coverage report is reviewer+ analytics (spec 20 §3.3 C5 / canReadArticleAnalytics);
        # the service token may call it too.
        if principal.kind != "service":
            require_capability(principal, "article.publish")
        reviewer = get_reviewer()
        if reviewer is None:
            raise HTTPException(status_code=503, detail="The AI Assistant is not configured.")

        cluster_request = GapClusteringRequest(
            gaps=[GapItem(id=gap.id, question=gap.question) for gap in body.gaps]
        )
        with get_tracer().start_as_current_span(
            "assistant.cluster_gaps", attributes={"tb.gaps": len(body.gaps)}
        ) as span:
            try:
                result = await asyncio.to_thread(reviewer.cluster_gaps, cluster_request)
            except ReviewError as exc:
                span.set_status(Status(StatusCode.ERROR, str(exc)))
                log.warning("assistant.cluster_gaps.failed", error=str(exc))
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            span.set_attribute("tb.clusters", len(result.clusters))

        log.info(
            "assistant.cluster_gaps",
            gaps=len(body.gaps),
            clusters=len(result.clusters),
            caller=principal.kind,
        )
        return ClusterGapsResponse(
            clusters=[
                GapClusterInfo(label=cluster.label, theme=cluster.theme, gapIds=cluster.gap_ids)
                for cluster in result.clusters
            ]
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
