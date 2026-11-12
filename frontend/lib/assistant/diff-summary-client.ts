/**
 * Calls the FastAPI diff-summary endpoint (`POST /assistant/diff-summary`,
 * spec 20 §3.3 C1) from the BFF with the caller's user assertion. Returns a
 * plain-English summary of what changed between two versions, grounded only in
 * the section diffs the BFF computed server-side.
 */

import { context } from "@opentelemetry/api";
import { injectTraceHeaders } from "@/lib/otel/ingest";

export class DiffSummaryError extends Error {}

export type DiffChange = {
  title: string;
  status: "changed" | "added" | "removed";
  before: string;
  after: string;
};

export type DiffSummary = {
  summary: string;
  changes: string[];
};

export async function requestDiffSummary(args: {
  title: string;
  fromVersion: string;
  toVersion: string;
  changes: DiffChange[];
  assertion: string;
}): Promise<DiffSummary> {
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
    response = await fetch(`${base}/assistant/diff-summary`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: args.title,
        fromVersion: args.fromVersion,
        toVersion: args.toVersion,
        changes: args.changes,
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new DiffSummaryError(
      timedOut
        ? "The assistant timed out."
        : "The assistant is not running (start backend/ on port 8080).",
    );
  }

  if (!response.ok) {
    const message =
      response.status === 503
        ? "The AI Assistant is not configured."
        : "The assistant could not summarize these changes. Try again.";
    throw new DiffSummaryError(message);
  }

  const body = (await response.json()) as { summary?: string; changes?: string[] };
  return { summary: body.summary ?? "", changes: body.changes ?? [] };
}
