/**
 * Calls the FastAPI tidy endpoint (`POST /assistant/tidy`, spec 20 §3.2 B3) from
 * the BFF with the caller's user assertion. Returns the tidied ParsedDraft plus
 * the category/tag slugs the model chose from the offered taxonomy.
 */

import { context } from "@opentelemetry/api";
import { injectTraceHeaders } from "@/lib/otel/ingest";
import type { ParsedDraft } from "@/lib/ingestion/to-draft";

export class TidyError extends Error {}

export type TidyResult = {
  draft: ParsedDraft;
  categorySlug: string | null;
  tagSlugs: string[];
};

type TaxonomyOption = { slug: string; name: string };

export async function requestTidy(args: {
  content: string;
  categories: TaxonomyOption[];
  tags: TaxonomyOption[];
  assertion: string;
}): Promise<TidyResult> {
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
    response = await fetch(`${base}/assistant/tidy`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        content: args.content,
        categories: args.categories,
        tags: args.tags,
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new TidyError(
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
          ? "The assistant could not tidy this draft. Try again."
          : "The assistant could not tidy this draft.";
    throw new TidyError(message);
  }

  const body = (await response.json()) as {
    draft?: ParsedDraft;
    categorySlug?: string | null;
    tagSlugs?: string[];
  };
  if (!body.draft) throw new TidyError("The assistant returned an empty draft.");
  return {
    draft: body.draft,
    categorySlug: body.categorySlug ?? null,
    tagSlugs: body.tagSlugs ?? [],
  };
}
