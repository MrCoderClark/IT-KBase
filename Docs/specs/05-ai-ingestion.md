# 05 — AI Ingestion Pipeline

> How a Word or PDF file becomes a validated, structured `ArticleDraft`. The LLM is one bounded step inside this pipeline, not the pipeline.

## 0. First slice

The browser PUTs a `.docx` or `.pdf` to object storage, then Next creates an `IngestionJob` and returns the job id. The import page opens `GET /api/jobs/{id}/stream`. That route calls `POST /ingest` with `Accept: text/event-stream`, forwards parse → segment → extract → validate events with `durationMs`, saves the draft, and emits `done` with the slug and a `trace` of stage timings. The same trace is stored on `IngestionJob.trace` and returned by `GET /api/jobs/{id}`. The file bytes do not go through a Next server action. A PDF page that is a picture with almost no text is noted and left unread. When `AI_API_KEY` is set, the model structures that extracted text into the article and returns JSON. A section the text does not support is left empty. Invalid JSON gets one repair, then the parser draft is kept. The call is OpenAI-compatible (`AI_BASE_URL`, `AI_MODEL`), including OpenRouter. There is still no BullMQ worker and no Redis event stream; those stay the flow in §2 and §4. The full S3 artifact bundle in §5 is later. `POST /v1/parse/docx` and `POST /v1/parse/pdf` remain and run the same reader. Storage uses `TB_S3_ENDPOINT`, `TB_S3_BUCKET`, `TB_S3_REGION`, `TB_S3_ACCESS_KEY`, and `TB_S3_SECRET_KEY` on the Python service. The bucket has to allow the browser to PUT.

## 1. Goals

1. **High structural fidelity**: produce the canonical section shape (Overview / Prerequisites / Steps / Verification / Troubleshooting / Related) when the source clearly has it, and a best-effort mapping when it doesn't.
2. **No silent lies**: if the LLM returns malformed or hallucinated content, fail loudly or repair, never pretend.
3. **Nothing lost**: on any kind of failure, the user can still open the raw extracted text as a draft.
4. **Observable**: every pipeline run has a trace with per-stage timings and a persisted artifact for debugging.

## 2. End-to-end flow

```
                    ┌──────────────────┐
Browser  ──PUT──▶  │       S3         │
                    └────────┬─────────┘
                             │ key
                             ▼
            POST /api/upload/complete
                             │ enqueues BullMQ
                             ▼
                   ┌───────────────────┐
                   │  BullMQ "ingest"  │
                   └────────┬──────────┘
                            │ worker: Python ingestion
                            ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 1: parse       (docx | pdf)         → RawDoc      │
│ Stage 2: normalize   (clean whitespace,   → NormDoc     │
│                       drop boilerplate)                  │
│ Stage 3: segment     (headings → candidate → Segments   │
│                       sections)                          │
│ Stage 4: extract     (LLM: text → typed   → DraftProto  │
│                       article blocks)                    │
│ Stage 5: validate    (Pydantic + repair)  → Draft       │
│ Stage 6: persist     (POST to Next.js)    → articleId   │
└─────────────────────────────────────────────────────────┘
                            │  (events on each stage)
                            ▼
                 Redis stream "jobs:{id}:events"
                            │
                            ▼
                     SSE → Browser UI
```

## 3. Stage detail

### 3.1 Parse

- **DOCX**: `python-docx` → iterate blocks. Preserve paragraph `style_id` (which gives us Heading 1/2/3), list levels, bold/italic runs, hyperlinks, inline images, and tables. Dump into a flat `RawDoc.blocks: list[RawBlock]`.
- **PDF**: `pdfplumber` for text + layout. If a page's text density is below a threshold, mark it as "likely scanned" and record it. v1 skips OCR; v1.1 adds a Tesseract fallback behind a config flag.
- **Fallback**: if either parser raises, run `unstructured` on the raw bytes to get a block list; mark the job with `low_fidelity_source=true`.

Output: `RawDoc { blocks: [RawBlock], meta: {page_count, author, title, created, ...} }`

### 3.2 Normalize

- Strip repeating header/footer blocks (detected by exact match across 50% of pages).
- Collapse 3+ consecutive blank lines.
- Fix orphaned hyphenated line breaks (`admini-\nstrator` → `administrator`) in PDF.
- Normalize smart quotes/dashes in text.
- Drop obviously-non-content blocks: page numbers (`^\d+$`), classification banners (`CONFIDENTIAL`), legal footers (configurable regex list).
- Preserve images and their captions.

### 3.3 Segment

- Walk blocks in order. A **Heading 1 or 2** opens a new segment. Each segment carries `title`, `heading_level`, `blocks: [RawBlock]`.
- Compute **candidate section kind** for each segment via lexical heuristics (`title in {Overview, Summary, Introduction} → overview`, etc.). The LLM gets this as a *suggestion*, not a lock.

### 3.4 Extract (LLM)

The one place an LLM runs. Interface:

```python
class KBExtractor(Protocol):
    def structure(
        self,
        norm_doc: NormDoc,
        segments: list[Segment],
        meta: DocMeta,
    ) -> DraftProto: ...
```

Implementations:
- `OpenAIExtractor` (default, GPT-4.1 class)
- `AnthropicExtractor` (Claude 4+)
- `LocalExtractor` (vLLM + Llama 3.1 70B instruct, for air-gapped)
- `FakeExtractor` for tests — deterministic transformation of segments to a DraftProto.

**Prompt contract**:
- System prompt: role (IT KB editor), style rules (imperative, concise), the **exact JSON schema** of `ArticleDraft`, and 2 few-shot examples (one DOCX-ish, one PDF-ish).
- User message: `meta`, `candidate_sections`, and the normalized text per segment.
- Response: **JSON only**, no prose.
- Model is instructed to:
  - Use the canonical section kinds whenever reasonable.
  - Preserve commands verbatim inside `code` blocks.
  - Convert "Note:" and "Warning:" phrasings into `callout` blocks of the appropriate variant.
  - Never invent facts; if information is missing, omit the section.

**Model params**: `temperature=0.1`, `top_p=0.9`, response_format=`json_object`, max tokens sized to the document length.

**Guardrails**:
- Hard token budget per job (default 60k input / 8k output).
- If the document exceeds the budget, segments are extracted independently and merged.

### 3.5 Validate

- Parse LLM output with Pydantic `ArticleDraftModel`.
- On validation error:
  - **One repair pass**: send the error list back to the model with "fix only the validation errors; keep the rest identical" instruction.
  - On second failure: produce a `low_confidence_draft` with every segment as a `custom` section (no shape promises), and mark the job `succeeded_with_warnings`.
- Post-validation checks:
  - Title is present and ≤ 160 chars.
  - At least one section exists.
  - All `step` blocks have `number >= 1` and are sequential within their section.
  - No `callout.variant` outside the enum.
  - All referenced images exist in the uploaded artifact (if any).

### 3.6 Persist

- Ingestion service calls `POST /api/internal/articles` with a service-scoped bearer token.
- Next.js creates the `Article` + `ArticleVersion` in a transaction and returns the slug.
- Ingestion service emits a final `done` event with `{ articleId, slug }`.

## 4. Progress events

Each stage emits exactly one `started` event and one `succeeded`/`failed` event. Event schema:

```json
{
  "jobId": "ckx...",
  "ts": "2026-10-12T15:04:05.123Z",
  "stage": "extracting",            // parsing | segmenting | extracting | validating | done
  "status": "started",              // started | succeeded | failed
  "detail": "Structuring the article",
  "progress": 0.42,                 // 0..1, best effort
  "durationMs": 91234               // set on succeeded/failed for that stage
}
```

Browser subscribes to `/api/jobs/{id}/stream` (Server-Sent Events) and renders the stepper UI from these events.

## 5. Determinism & reproducibility

- Each run writes an artifact bundle to S3: `uploads/{yyyy}/{mm}/{jobId}/artifact.json` with:
  - `raw_doc`, `norm_doc`, `segments`
  - LLM prompt + raw response
  - `draft_proto` (before validation)
  - final `draft`
  - timings per stage
- Replay command: `uv run ingest replay {jobId}` runs the pipeline against the stored `raw_doc` with the current extractor. Used in CI tests and for debugging regressions.

## 6. Rate limits, quotas, cost control

- Per-user: 20 ingestions / day (configurable). Enforced via `rate:{userId}:ingest:{yyyymmdd}` in Redis.
- Per-tenant: configurable monthly token budget. When 80% reached, dashboard surfaces a warning; 100% blocks new jobs until next period or admin override.
- Each extractor records tokens in/out and estimated cost; stored on `IngestionJob`.

## 7. Testing

- **Unit** (pytest): parser outputs for a corpus of real DOCX/PDF samples in `services/ingestion/tests/fixtures/`. We assert block counts, heading detection, and specific tricky cases (page breaks mid-list, nested tables).
- **Pipeline** (pytest): run with `FakeExtractor`, assert the final `Draft` matches a golden JSON.
- **Live-model smoke** (pytest, marked `@pytest.mark.live`): small corpus, run against the real provider nightly, snapshot deltas.
- **Repair-pass** test: inject a known-malformed LLM response, assert it's repaired.

## 8. Security & privacy

- Uploaded files are **not retained** beyond 30 days by default. The artifact bundle (which contains the full extracted text) is retained for 7 days, then deleted unless the job was flagged for review.
- The LLM prompt may contain content from the document. If the tenant has `allow_llm_processing=false`, the pipeline refuses to run the extract stage and falls through to the `custom`-section fallback with no LLM involvement.
- Prompts never contain credentials from the user's environment variables; the service's own secrets are injected server-side only.
- Logs redact raw document text; only the artifact bundle (behind access control) has it.
