/**
 * Calls the FastAPI cluster-gaps endpoint (`POST /assistant/cluster-gaps`,
 * spec 20 §3.3 C5) from the BFF with the caller's user assertion. Sends the open
 * gap questions (indexed by id) and returns the model's grouping — a label, a
 * theme, and the member ids per cluster. The BFF sums the demand deterministically
 * with `buildGapClusters`; the model only groups.
 */

import { context } from "@opentelemetry/api";
import { injectTraceHeaders } from "@/lib/otel/ingest";
import type { RawGapCluster } from "@/lib/assistant/coverage";

export class ClusterGapsError extends Error {}

export async function requestGapClusters(args: {
  gaps: { id: string; question: string }[];
  assertion: string;
}): Promise<RawGapCluster[]> {
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
    response = await fetch(`${base}/assistant/cluster-gaps`, {
      method: "POST",
      headers,
      body: JSON.stringify({ gaps: args.gaps }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new ClusterGapsError(
      timedOut
        ? "The assistant timed out."
        : "The assistant is not running (start backend/ on port 8080).",
    );
  }

  if (!response.ok) {
    const message =
      response.status === 503
        ? "The AI Assistant is not configured."
        : "The assistant could not cluster the gaps. Try again.";
    throw new ClusterGapsError(message);
  }

  const body = (await response.json()) as { clusters?: RawGapCluster[] };
  return (body.clusters ?? []).map((cluster) => ({
    label: cluster.label ?? "",
    theme: cluster.theme ?? "",
    gapIds: cluster.gapIds ?? [],
  }));
}
