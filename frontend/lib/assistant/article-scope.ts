/**
 * Article scope for "Ask this article" (spec 20 §3 A2): the open article plus
 * its lexical related set. Mirrors the FTS ranking of `getRelatedArticles`
 * (same-category boosted) but returns article *ids* and excludes the non-lexical
 * filler that helper adds for the right rail — scope must stay on-topic, not
 * drift to "recent articles". Access is still enforced downstream by
 * `retrieveChunks` (visibility clause + `filterOpenArticleIds`); the related set
 * here is published-only, so it leaks nothing.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { relatedSearchText } from "@/lib/kb/related";

/** Related published articles pulled into the scope, beyond the open one. */
const RELATED_SCOPE_LIMIT = 4;

export async function resolveArticleScope(articleId: string): Promise<string[]> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      summary: true,
      category: { select: { slug: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });
  if (!article) return [];

  const queryText = relatedSearchText({
    title: article.title,
    summary: article.summary,
    tags: article.tags.map((t) => ({ name: t.tag.name })),
  });
  if (!queryText) return [article.id];

  const categorySlug = article.category?.slug ?? "";
  const hasCategory = Boolean(article.category?.slug);
  const related = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    WITH q AS (SELECT plainto_tsquery('english', ${queryText}) AS query)
    SELECT a.id
    FROM "public"."Article" a
    CROSS JOIN q
    LEFT JOIN "public"."Category" c ON c.id = a."categoryId"
    WHERE a.status = 'published'
      AND a.id <> ${article.id}
      AND numnode(q.query) > 0
      AND a."searchVector" @@ q.query
    ORDER BY
      CASE WHEN ${hasCategory} AND c.slug = ${categorySlug} THEN 1 ELSE 0 END DESC,
      ts_rank(a."searchVector", q.query) DESC,
      a."updatedAt" DESC
    LIMIT ${RELATED_SCOPE_LIMIT}
  `);

  return [article.id, ...related.map((r) => r.id)];
}
