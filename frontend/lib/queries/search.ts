import { Prisma } from "@prisma/client";
import { can, type Role } from "@/lib/auth/policy";
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

/** Same rule as `canReadArticle`, expressed for the raw search query. */
function searchVisibility(role: Role, userId: string): Prisma.Sql {
  if (can(role, "article.archive")) return Prisma.sql`TRUE`;
  if (can(role, "article.editAny")) return Prisma.sql`a.status::text <> 'archived'`;
  if (can(role, "article.editOwn")) {
    return Prisma.sql`(a.status::text = 'published' OR (a."authorId" = ${userId} AND a.status::text IN ('draft', 'in_review')))`;
  }
  return Prisma.sql`a.status::text = 'published'`;
}

export async function searchArticles(
  query: string,
  limit: number,
  role: Role,
  userId: string,
): Promise<SearchHit[]> {
  const visibility = searchVisibility(role, userId);
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
      AND ${visibility}
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
