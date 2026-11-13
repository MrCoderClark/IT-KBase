/**
 * Calls the FastAPI miscategorized endpoint (`POST /assistant/miscategorized`,
 * spec 20 §3.3 C6) from the BFF with the caller's user assertion. Sends published
 * categorized articles plus the candidate category list; returns the articles the
 * model judged to be in the wrong category, each with a suggested slug (validated
 * backend-side against the supplied set), a reason, and a confidence.
 */

import { context } from "@opentelemetry/api";
import { injectTraceHeaders } from "@/lib/otel/ingest";

export class MiscategorizedError extends Error {}

export type MiscategorizedFlag = {
  articleId: string;
  suggested: string;
  reason: string;
  confidence: string;
};

export async function requestMiscategorized(args: {
  articles: {
    id: string;
    title: string;
    summary: string;
    currentCategory: string;
    currentSlug: string;
    excerpt: string;
  }[];
  categories: { slug: string; name: string }[];
  assertion: string;
}): Promise<MiscategorizedFlag[]> {
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
    response = await fetch(`${base}/assistant/miscategorized`, {
      method: "POST",
      headers,
      body: JSON.stringify({ articles: args.articles, categories: args.categories }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new MiscategorizedError(
      timedOut
        ? "The assistant timed out."
        : "The assistant is not running (start backend/ on port 8080).",
    );
  }

  if (!response.ok) {
    const message =
      response.status === 503
        ? "The AI Assistant is not configured."
        : "The assistant could not review the categories. Try again.";
    throw new MiscategorizedError(message);
  }

  const body = (await response.json()) as { flags?: MiscategorizedFlag[] };
  return (body.flags ?? []).map((flag) => ({
    articleId: flag.articleId ?? "",
    suggested: flag.suggested ?? "",
    reason: flag.reason ?? "",
    confidence: flag.confidence ?? "low",
  }));
}
