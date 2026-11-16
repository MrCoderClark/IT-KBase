/**
 * Calls the FastAPI listwise reranker (`POST /assistant/rerank`, spec 20 §12
 * AI-5 slice 2). Runs after the fused SQL query and the access gate, so the
 * service never sees text the user could not read.
 *
 * The caller (`retrieveChunks`) mints a 60s user assertion and passes it in,
 * same pattern as `embed-client.ts`. On any failure this throws
 * `CrossEncoderError` so the caller can fall back to the deterministic
 * `rerankChunks` — the fused order is always a safe floor.
 */

import { context } from "@opentelemetry/api";
import { injectTraceHeaders } from "@/lib/otel/ingest";

/** Keep in sync with `backend/src/backend/assistant/reranker.py` `_MAX_CANDIDATES`. */
export const CROSS_ENCODER_MAX_CANDIDATES = 24;
const TEXT_MAX_CHARS = 4_000;
const TITLE_MAX_CHARS = 300;
const QUESTION_MAX_CHARS = 2_000;

export type CrossEncoderCandidate = {
  id: string;
  title: string;
  text: string;
};

export type CrossEncoderResult = {
  /** Model score per candidate id, in [0, 1]. Ids the model omitted are absent. */
  scores: Record<string, number>;
};

export class CrossEncoderError extends Error {}

/**
 * Score `candidates` against `question` via the FastAPI reranker. Returns
 * `{ scores: {} }` without hitting the network for a trivial batch (< 2
 * candidates), to match the backend's "nothing to reorder" short-circuit.
 */
export async function rerankViaLLM(
  question: string,
  candidates: CrossEncoderCandidate[],
  assertion: string,
): Promise<CrossEncoderResult> {
  if (candidates.length < 2) return { scores: {} };

  const bounded = candidates.slice(0, CROSS_ENCODER_MAX_CANDIDATES).map((cand) => ({
    id: cand.id,
    title: clamp(cand.title, TITLE_MAX_CHARS),
    text: clamp(cand.text, TEXT_MAX_CHARS) || "(empty)",
  }));
  const payload = {
    question: clamp(question, QUESTION_MAX_CHARS) || "(empty)",
    candidates: bounded,
  };

  const base = (process.env.INGESTION_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  let response: Response;
  try {
    const headers = injectTraceHeaders(
      {
        Authorization: `Bearer ${assertion}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      context.active(),
    );
    response = await fetch(`${base}/assistant/rerank`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new CrossEncoderError(
      timedOut
        ? "The assistant reranker timed out."
        : "The assistant reranker is not running (start backend/ on port 8080).",
    );
  }

  if (!response.ok) {
    throw new CrossEncoderError(`The assistant reranker returned HTTP ${response.status}.`);
  }

  const body = (await response.json()) as { scores?: Record<string, unknown> };
  const raw = body.scores ?? {};
  const scores: Record<string, number> = {};
  for (const [id, value] of Object.entries(raw)) {
    // Accept only genuine numbers — `Number(null)` is 0, which would silently
    // turn a "couldn't score" signal into a real 0.0 score.
    if (typeof value === "number" && Number.isFinite(value)) {
      scores[id] = Math.max(0, Math.min(1, value));
    }
  }
  return { scores };
}

function clamp(text: string, limit: number): string {
  const trimmed = text.trim();
  return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
}

/** Scorable subset of RetrievedChunk — just what the ordering needs. */
export interface Scorable {
  chunkId: string;
  /** The fused RRF score; tie-breaker beneath the LLM score. */
  score: number;
}

/**
 * Reorder `candidates` by `(llmScore, fusedScore, incomingIndex)` descending.
 * Chunks the model did not score fall below every scored chunk and keep their
 * incoming fused order relative to each other (stable sort). Pure and DB-free
 * so it unit-tests under `tsx --test`.
 */
export function applyLlmScores<T extends Scorable>(
  candidates: T[],
  scores: Record<string, number>,
): T[] {
  if (candidates.length < 2 || Object.keys(scores).length === 0) return candidates;
  return candidates
    .map((chunk, index) => ({ chunk, index, llm: scores[chunk.chunkId] ?? -1 }))
    .sort((a, b) => b.llm - a.llm || b.chunk.score - a.chunk.score || a.index - b.index)
    .map((entry) => entry.chunk);
}
