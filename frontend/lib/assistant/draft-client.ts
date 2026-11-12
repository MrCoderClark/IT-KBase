/**
 * Calls the FastAPI drafter (`POST /assistant/draft`, spec 20 §3.2 B2) from the
 * BFF with the caller's user assertion. Returns a `ParsedDraft` the editor maps
 * with `parsedToDraft`. Non-streaming — drafting is one-shot.
 */

import { context } from "@opentelemetry/api";
import { injectTraceHeaders } from "@/lib/otel/ingest";
import type { ParsedDraft } from "@/lib/ingestion/to-draft";

export class DraftError extends Error {}

export async function requestDraft(args: {
  notes: string;
  mode: "notes";
  assertion: string;
}): Promise<ParsedDraft> {
  const base = (process.env.INGESTION_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  const headers = injectTraceHeaders(
    {
      Authorization: `Bearer ${args.assertion}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    context.active(),
  );

  let response: Response;
  try {
    response = await fetch(`${base}/assistant/draft`, {
      method: "POST",
      headers,
      body: JSON.stringify({ notes: args.notes, mode: args.mode }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new DraftError(
      timedOut
        ? "The assistant timed out."
        : "The assistant is not running (start backend/ on port 8080).",
    );
  }

  if (!response.ok) {
    const message =
      response.status === 503
        ? "The AI Assistant is not configured."
        : response.status === 502
          ? "The assistant could not produce a draft. Try rephrasing your notes."
          : "The assistant could not produce a draft.";
    throw new DraftError(message);
  }

  const body = (await response.json()) as { draft?: ParsedDraft };
  if (!body.draft) throw new DraftError("The assistant returned an empty draft.");
  return body.draft;
}
