/**
 * Calls the FastAPI embedder (`POST /assistant/embed`, spec 20 §7.2) for the
 * indexer and backfill. Authenticates with a short-lived user assertion minted
 * from `AUTH_ASSERTION_KEYS` — the same 60s HMAC token the ingest worker uses
 * (the endpoint also accepts a `sv_` service token, but indexing reuses the
 * assertion so no extra secret is needed).
 *
 * The caller mints the token and passes it in. The service only ever embeds
 * text already stored in the KB; it sees nothing a user couldn't.
 */

import { context } from "@opentelemetry/api";
import { injectTraceHeaders } from "@/lib/otel/ingest";

/** Matches the endpoint's limits: 64 inputs per call, 8000 chars each. */
const MAX_INPUTS_PER_CALL = 64;
const MAX_CHARS = 8_000;

export type EmbedResult = {
  model: string;
  /** One vector per input, in the same order. */
  vectors: number[][];
};

export class EmbedError extends Error {}

/**
 * Embed `texts` in order, authenticating with `assertion` (a bearer minted by
 * the caller). Throws `EmbedError` when the service is reachable but fails, so
 * the caller can leave existing vectors in place rather than wipe them.
 */
export async function embedTexts(texts: string[], assertion: string): Promise<EmbedResult> {
  if (texts.length === 0) return { model: "", vectors: [] };

  const base = (process.env.INGESTION_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  const vectors: number[][] = [];
  let model = "";

  for (let start = 0; start < texts.length; start += MAX_INPUTS_PER_CALL) {
    const batch = texts.slice(start, start + MAX_INPUTS_PER_CALL).map(clampInput);
    const result = await embedBatch(base, assertion, batch);
    model = result.model;
    vectors.push(...result.vectors);
  }

  return { model, vectors };
}

function clampInput(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "(empty)"; // endpoint rejects empty strings; chunks are never empty in practice
  return trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS) : trimmed;
}

async function embedBatch(base: string, assertion: string, inputs: string[]): Promise<EmbedResult> {
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
    response = await fetch(`${base}/assistant/embed`, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new EmbedError(
      timedOut
        ? "The assistant embedder timed out."
        : "The assistant embedder is not running (start backend/ on port 8080).",
    );
  }

  if (!response.ok) {
    throw new EmbedError(`The assistant embedder returned HTTP ${response.status}.`);
  }

  const body = (await response.json()) as {
    model?: string;
    dimensions?: number;
    embeddings?: number[][];
  };
  const embeddings = body.embeddings ?? [];
  if (embeddings.length !== inputs.length) {
    throw new EmbedError("The assistant embedder returned the wrong number of vectors.");
  }
  return { model: body.model ?? "", vectors: embeddings };
}
