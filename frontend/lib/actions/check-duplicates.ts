"use server";

/**
 * B5 overlap check (spec 20 §3.2). Runs FTS from the live draft over *published*
 * articles, then gates the hits through `filterOpenArticleIds` so an author only
 * sees overlaps they're allowed to read. Published-only and permission-filtered,
 * so it leaks nothing. Read-only — it never changes the draft or the matches.
 */

import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { filterOpenArticleIds } from "@/lib/queries/page-access";
import { draftSearchText, type DuplicateMatch } from "@/lib/assistant/duplicates";

export type DuplicateResult =
  | { ok: true; matches: DuplicateMatch[] }
  | { ok: false; error: string };

/** Over-fetch before the permission filter, then trim to what we show. */
const CANDIDATE_POOL = 10;
const MAX_MATCHES = 5;

export async function checkDuplicates(input: {
  title: string;
  summary: string;
  tagNames: string[];
  /** The draft's own slug, excluded from its own overlap results. Null when new. */
  excludeSlug: string | null;
}): Promise<DuplicateResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sign in to check for overlapping articles." };

  const queryText = draftSearchText(input);
  if (!queryText) return { ok: true, matches: [] };

  const excludeSlug = input.excludeSlug ?? "";
  const rows = await prisma.$queryRaw<
    { id: string; slug: string; title: string; categoryName: string | null }[]
  >(Prisma.sql`
    WITH q AS (SELECT plainto_tsquery('english', ${queryText}) AS query)
    SELECT a.id, a.slug, a.title, c.name AS "categoryName"
    FROM "public"."Article" a
    CROSS JOIN q
    LEFT JOIN "public"."Category" c ON c.id = a."categoryId"
    WHERE a.status = 'published'
      AND a.slug <> ${excludeSlug}
      AND numnode(q.query) > 0
      AND a."searchVector" @@ q.query
    ORDER BY ts_rank(a."searchVector", q.query) DESC, a."updatedAt" DESC
    LIMIT ${CANDIDATE_POOL}
  `);
  if (rows.length === 0) return { ok: true, matches: [] };

  const open = await filterOpenArticleIds(
    session.role,
    session.userId,
    rows.map((row) => row.id),
  );

  const matches = rows
    .filter((row) => open.has(row.id))
    .slice(0, MAX_MATCHES)
    .map((row) => ({ slug: row.slug, title: row.title, categoryName: row.categoryName }));

  return { ok: true, matches };
}
