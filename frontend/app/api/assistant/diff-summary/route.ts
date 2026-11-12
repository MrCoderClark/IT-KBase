/**
 * BFF for the reviewer's "version diff summary" (spec 20 §3.3 C1). Gates to
 * reviewer+ (version history), rate-limits, and computes the section diff
 * server-side from the two stored snapshots — the client sends only the slug and
 * the two versions, never article content. Returns a plain-English summary; it
 * is informational and changes nothing.
 */

import { canReadArticleHistory } from "@/lib/auth/policy";
import { mintIngestionAssertion } from "@/lib/auth/assertion";
import { checkAssistantRate } from "@/lib/assistant/rate-limit";
import {
  requestDiffSummary,
  DiffSummaryError,
  type DiffChange,
} from "@/lib/assistant/diff-summary-client";
import { getSession } from "@/lib/auth/session";
import { getArticleVersion } from "@/lib/queries/articles";
import { compareSections } from "@/lib/kb/section-compare";

export const maxDuration = 180;

type Body = { slug?: string; from?: string; to?: string };

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!canReadArticleHistory(session.role)) {
    return Response.json({ error: "You do not have permission to do that." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const slug = (body.slug ?? "").trim();
  const from = (body.from ?? "").trim();
  const to = (body.to ?? "").trim();
  if (!slug || !from || !to) {
    return Response.json({ error: "A slug and two versions are required." }, { status: 400 });
  }

  const [fromSnap, toSnap] = await Promise.all([
    getArticleVersion(slug, from),
    getArticleVersion(slug, to),
  ]);
  if (!fromSnap || !toSnap) {
    return Response.json({ error: "One of those versions was not found." }, { status: 404 });
  }

  // from on the left, to on the right: changed sections differ, only-left is
  // dropped in `to` (removed), only-right is new in `to` (added).
  const changes: DiffChange[] = [];
  for (const row of compareSections(fromSnap.article.sections, toSnap.article.sections)) {
    if (row.status === "unchanged") continue;
    if (row.status === "changed") {
      changes.push({
        title: row.left?.title ?? row.right?.title ?? "Section",
        status: "changed",
        before: row.left?.text ?? "",
        after: row.right?.text ?? "",
      });
    } else if (row.status === "only-left") {
      changes.push({ title: row.left?.title ?? "Section", status: "removed", before: row.left?.text ?? "", after: "" });
    } else {
      changes.push({ title: row.right?.title ?? "Section", status: "added", before: "", after: row.right?.text ?? "" });
    }
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
    const result = await requestDiffSummary({
      title: toSnap.article.title,
      fromVersion: from,
      toVersion: to,
      changes,
      assertion,
    });
    return Response.json(result);
  } catch (err) {
    const message =
      err instanceof DiffSummaryError
        ? err.message
        : "The assistant could not summarize these changes.";
    const status = /not configured/.test(message) ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
