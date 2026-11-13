/**
 * Calls the FastAPI feedback-digest endpoint (`POST /assistant/feedback-digest`,
 * spec 20 §3.3 C4) from the BFF with the caller's user assertion. Returns themes
 * and suggested edits drawn only from the not-helpful comments the BFF collected
 * server-side.
 */

import { context } from "@opentelemetry/api";
import { injectTraceHeaders } from "@/lib/otel/ingest";

export class FeedbackDigestError extends Error {}

export type FeedbackDigest = {
  summary: string;
  themes: string[];
  suggestions: string[];
};

export async function requestFeedbackDigest(args: {
  title: string;
  comments: string[];
  assertion: string;
}): Promise<FeedbackDigest> {
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
    response = await fetch(`${base}/assistant/feedback-digest`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: args.title, comments: args.comments }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new FeedbackDigestError(
      timedOut
        ? "The assistant timed out."
        : "The assistant is not running (start backend/ on port 8080).",
    );
  }

  if (!response.ok) {
    const message =
      response.status === 503
        ? "The AI Assistant is not configured."
        : "The assistant could not digest this feedback. Try again.";
    throw new FeedbackDigestError(message);
  }

  const body = (await response.json()) as {
    summary?: string;
    themes?: string[];
    suggestions?: string[];
  };
  return {
    summary: body.summary ?? "",
    themes: body.themes ?? [],
    suggestions: body.suggestions ?? [],
  };
}
