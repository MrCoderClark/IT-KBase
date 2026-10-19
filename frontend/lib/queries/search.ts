import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SNIPPET_START, SNIPPET_STOP } from "@/lib/kb/search";
import type { ArticleStatus } from "@/lib/types/article";

export type SearchHit = {
  slug: string;
  title: string;
  status: ArticleStatus;
  category: string | null;
  snippet: string;
};

export async function searchArticles(query: string, limit: number): Promise<SearchHit[]> {
  const rows = await prisma.$queryRaw<
    { slug: string; title: string; status: ArticleStatus; category: string | null; snippet: string | null }[]
  >(Prisma.sql`
    WITH query AS (
      SELECT websearch_to_tsquery('english', ${query}) AS q
    )
    SELECT
      a.slug,
      a.title,
      a.status::text AS status,
      c.name AS category,
      ts_headline(
        'english',
        coalesce(public.article_search_plain(a.id), a.title),
        query.q,
        ${`MaxFragments=1, MaxWords=24, MinWords=6, StartSel=${SNIPPET_START}, StopSel=${SNIPPET_STOP}`}
      ) AS snippet
    FROM "public"."Article" a
    CROSS JOIN query
    LEFT JOIN "public"."Category" c ON c.id = a."categoryId"
    WHERE a."searchVector" @@ query.q
    ORDER BY ts_rank(a."searchVector", query.q) DESC, a.title ASC
    LIMIT ${limit}
  `);
  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    status: row.status,
    category: row.category,
    snippet: row.snippet ?? "",
  }));
}
