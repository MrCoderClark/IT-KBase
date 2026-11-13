/**
 * BFF for the reviewer's coverage-gap clustering (spec 20 §3.3 C5). Gates to
 * reviewer+ (analytics), rate-limits, and collects the open knowledge gaps
 * server-side — the client sends nothing. The model groups the gap questions into
 * themes; `buildGapClusters` then sums demand deterministically and ranks the
 * clusters. Informational only — it changes nothing.
 */

import { canReadArticleAnalytics } from "@/lib/auth/policy";
import { mintIngestionAssertion } from "@/lib/auth/assertion";
import { checkAssistantRate } from "@/lib/assistant/rate-limit";
import { requestGapClusters, ClusterGapsError } from "@/lib/assistant/cluster-gaps-client";
import { buildGapClusters } from "@/lib/assistant/coverage";
import { getCoverageGaps } from "@/lib/queries/coverage";
import { getSession } from "@/lib/auth/session";

export const maxDuration = 180;

export async function POST(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!canReadArticleAnalytics(session.role)) {
    return Response.json({ error: "You do not have permission to do that." }, { status: 403 });
  }

  const gaps = await getCoverageGaps();
  if (gaps.length < 2) {
    // Nothing worth clustering — the flat ranked list already serves this.
    return Response.json({ clusters: [] });
  }

  const rate = await checkAssistantRate(session.userId);
  if (!rate.ok) {
    return Response.json(
      { error: "You've reached the assistant limit. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const assertion = await mintIngestionAssertion(session, new Date());
  if (!assertion) {
    return Response.json({ error: "The AI Assistant is not configured." }, { status: 503 });
  }

  try {
    const raw = await requestGapClusters({
      gaps: gaps.map((gap, index) => ({ id: String(index), question: gap.sampleQuestion })),
      assertion,
    });
    return Response.json({ clusters: buildGapClusters(gaps, raw) });
  } catch (err) {
    const message =
      err instanceof ClusterGapsError ? err.message : "The assistant could not cluster the gaps.";
    const status = /not configured/.test(message) ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
