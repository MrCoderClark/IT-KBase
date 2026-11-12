/**
 * BFF for the authoring copilot's "draft from notes" (spec 20 §3.2 B2). Gates to
 * author+ (article.create), rate-limits like the rest of the assistant, mints a
 * user assertion, and returns the generated ParsedDraft as JSON. The editor maps
 * it with parsedToDraft and the author saves it — the model never writes the DB.
 */

import { can } from "@/lib/auth/policy";
import { mintIngestionAssertion } from "@/lib/auth/assertion";
import { checkAssistantRate } from "@/lib/assistant/rate-limit";
import { DraftError, requestDraft } from "@/lib/assistant/draft-client";
import { getSession } from "@/lib/auth/session";

export const maxDuration = 180;

type Body = {
  mode?: "notes" | "prompt";
  notes?: string;
  prompt?: string;
  categories?: string[];
  tags?: string[];
};

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

  const mode = body.mode === "prompt" ? "prompt" : "notes";
  const notes = (body.notes ?? "").trim();
  const prompt = (body.prompt ?? "").trim();
  if (mode === "notes" && !notes) {
    return Response.json({ error: "Add some notes to draft from." }, { status: 400 });
  }
  if (mode === "prompt" && !prompt) {
    return Response.json({ error: "Describe the article to draft." }, { status: 400 });
  }
  if (notes.length > 16_000) {
    return Response.json({ error: "Those notes are too long." }, { status: 400 });
  }
  if (prompt.length > 2_000) {
    return Response.json({ error: "That prompt is too long." }, { status: 400 });
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

  const categories = (body.categories ?? []).filter((c) => typeof c === "string").slice(0, 60);
  const tags = (body.tags ?? []).filter((t) => typeof t === "string").slice(0, 120);

  try {
    const draft = await requestDraft({ mode, notes, prompt, categories, tags, assertion });
    return Response.json({ draft });
  } catch (err) {
    const message =
      err instanceof DraftError ? err.message : "The assistant could not produce a draft.";
    const status = /not configured/.test(message) ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
