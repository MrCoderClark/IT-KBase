/**
 * BFF for the admin taxonomy "miscategorized articles" check (spec 20 §3.3 C6).
 * Gates to admin, rate-limits, and assembles the input server-side — published
 * categorized articles plus the category list — so the client sends nothing. The
 * model flags articles in the wrong category; this enriches each flag with the
 * article and category names for display. Informational only — it changes nothing.
 */

import { can } from "@/lib/auth/policy";
import { mintIngestionAssertion } from "@/lib/auth/assertion";
import { checkAssistantRate } from "@/lib/assistant/rate-limit";
import {
  requestMiscategorized,
  MiscategorizedError,
} from "@/lib/assistant/miscategorized-client";
import { getMiscategorizedInput } from "@/lib/queries/miscategorized";
import { getSession } from "@/lib/auth/session";

export const maxDuration = 180;

const CONFIDENCE_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export async function POST(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!can(session.role, "admin.manage")) {
    return Response.json({ error: "You do not have permission to do that." }, { status: 403 });
  }

  const { articles, categories } = await getMiscategorizedInput();
  if (articles.length === 0 || categories.length < 2) {
    // Nothing to compare — need an article and an alternative category.
    return Response.json({ flags: [] });
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
    const raw = await requestMiscategorized({
      articles: articles.map((article) => ({
        id: article.id,
        title: article.title,
        summary: article.summary,
        currentCategory: article.categoryName,
        currentSlug: article.categorySlug,
        excerpt: article.excerpt,
      })),
      categories: categories.map((category) => ({ slug: category.slug, name: category.name })),
      assertion,
    });

    const articleById = new Map(articles.map((article) => [article.id, article]));
    const categoryBySlug = new Map(categories.map((category) => [category.slug, category.name]));

    const flags = raw
      .map((flag) => {
        const article = articleById.get(flag.articleId);
        const suggestedCategory = categoryBySlug.get(flag.suggested);
        if (!article || !suggestedCategory) return null;
        return {
          articleTitle: article.title,
          articleSlug: article.slug,
          currentCategory: article.categoryName,
          suggestedCategory,
          reason: flag.reason,
          confidence: flag.confidence,
        };
      })
      .filter((flag): flag is NonNullable<typeof flag> => flag !== null)
      .sort(
        (a, b) =>
          (CONFIDENCE_RANK[a.confidence] ?? 3) - (CONFIDENCE_RANK[b.confidence] ?? 3) ||
          a.articleTitle.localeCompare(b.articleTitle),
      );

    return Response.json({ flags });
  } catch (err) {
    const message =
      err instanceof MiscategorizedError
        ? err.message
        : "The assistant could not review the categories.";
    const status = /not configured/.test(message) ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
