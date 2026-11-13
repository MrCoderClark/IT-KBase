/**
 * Calls the FastAPI update-draft endpoint (`POST /assistant/update-draft`,
 * spec 20 §3.3 C3) from the BFF with the caller's user assertion. Returns a
 * refreshed ParsedDraft — the article rewritten to current practice, with the
 * flagged dated references addressed.
 */

import { context } from "@opentelemetry/api";
import { injectTraceHeaders } from "@/lib/otel/ingest";
import type { ParsedDraft } from "@/lib/ingestion/to-draft";

export class UpdateDraftError extends Error {}

export async function requestUpdateDraft(args: {
  content: string;
  outdated: string[];
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
    response = await fetch(`${base}/assistant/update-draft`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: args.content, outdated: args.outdated }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new UpdateDraftError(
      timedOut
        ? "The assistant timed out."
        : "The assistant is not running (start backend/ on port 8080).",
    );
  }

  if (!response.ok) {
    const message =
      response.status === 503
        ? "The AI Assistant is not configured."
        : "The assistant could not draft an update. Try again.";
    throw new UpdateDraftError(message);
  }

  const body = (await response.json()) as { draft?: ParsedDraft };
  if (!body.draft) throw new UpdateDraftError("The assistant returned an empty draft.");
  return body.draft;
}
