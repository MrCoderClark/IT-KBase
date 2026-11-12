/**
 * BFF for the authoring copilot's "tidy this draft" (spec 20 §3.2 B3). Gates to
 * author+, rate-limits, and resolves the taxonomy server-side (authoritative, so
 * the model can only choose from real categories/tags). Returns the tidied
 * ParsedDraft plus the chosen category/tag slugs; the editor applies them on the
 * author's accept — the model never writes the DB.
 */

import { can } from "@/lib/auth/policy";
import { mintIngestionAssertion } from "@/lib/auth/assertion";
import { checkAssistantRate } from "@/lib/assistant/rate-limit";
import { requestTidy, TidyError } from "@/lib/assistant/tidy-client";
import { getSession } from "@/lib/auth/session";
import { getAllCategories, getAllTags } from "@/lib/queries/articles";

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
  if (!content) return Response.json({ error: "There is nothing to tidy yet." }, { status: 400 });
  if (content.length > 24_000) {
    return Response.json({ error: "This draft is too long to tidy." }, { status: 400 });
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

  const [categories, tags] = await Promise.all([getAllCategories(), getAllTags()]);

  try {
    const result = await requestTidy({
      content,
      categories: categories.map((c) => ({ slug: c.slug, name: c.name })),
      tags: tags.map((t) => ({ slug: t.slug, name: t.name })),
      assertion,
    });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof TidyError ? err.message : "The assistant could not tidy this draft.";
    const status = /not configured/.test(message) ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
