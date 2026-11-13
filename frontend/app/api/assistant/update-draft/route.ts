/**
 * BFF for the authoring copilot's "draft an update" (spec 20 §3.3 C3). Gates to
 * author+, rate-limits, and derives the dated-reference flags server-side with
 * the same deterministic scan as the staleness triage (`outdatedReferences`), so
 * the refresh is steered by the same signals the reviewer saw. Returns a
 * refreshed ParsedDraft; the editor applies it on the author's accept — the
 * model never writes the DB.
 */

import { can } from "@/lib/auth/policy";
import { mintIngestionAssertion } from "@/lib/auth/assertion";
import { checkAssistantRate } from "@/lib/assistant/rate-limit";
import { requestUpdateDraft, UpdateDraftError } from "@/lib/assistant/update-draft-client";
import { outdatedReferences } from "@/lib/assistant/staleness";
import { getSession } from "@/lib/auth/session";

export const maxDuration = 180;

type Body = { content?: string };

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!can(session.role, "article.create")) {
    return Response.json({ error: "You do not have permission to do that." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const content = (body.content ?? "").trim();
  if (!content) return Response.json({ error: "There is nothing to update yet." }, { status: 400 });
  if (content.length > 24_000) {
    return Response.json({ error: "This draft is too long to update." }, { status: 400 });
  }

  const outdated = outdatedReferences(content).map((match) => `${match.label}: ${match.suggest}`);

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
    const draft = await requestUpdateDraft({ content, outdated, assertion });
    return Response.json({ draft });
  } catch (err) {
    const message =
      err instanceof UpdateDraftError ? err.message : "The assistant could not draft an update.";
    const status = /not configured/.test(message) ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
