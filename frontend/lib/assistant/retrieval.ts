/**
 * Hybrid retrieval for the AI Assistant (spec 20 §5.2). Runs in the BFF so the
 * permission model stays in TypeScript and FastAPI only ever sees text the user
 * may read (§5.1).
 *
 * Three ranking lists, each limited to readable articles, merged with
 * Reciprocal Rank Fusion:
 *   - keyword: ArticleChunk.searchVector @@ websearch_to_tsquery
 *   - vector:  embedding <=> query_vector  (cosine, HNSW)
 *   - exact:   chunks literally containing an error code / KB ID / cmdlet (A4)
 *
 * The SQL visibility clause is a coarse prefilter; the authoritative per-page
 * access check is `filterOpenArticleIds`, the same gate search uses. An answer
 * can never cite a chunk whose article the user could not open.
 */

import { Prisma } from "@prisma/client";
import { mintIngestionAssertion } from "@/lib/auth/assertion";
import { can, type Role } from "@/lib/auth/policy";
import type { AppSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { filterOpenArticleIds } from "@/lib/queries/page-access";
import { EmbedError, embedTexts } from "./embed-client";
import { extractExactTokens } from "./tokens";

/** Per-list candidate pool before fusion. */
const POOL = 50;
/** Ranked chunks returned to the caller before the token-budget cap. */
const DEFAULT_LIMIT = 12;
/**
 * Minimum fused score to treat an answer as grounded (§5.2 step 7). Below this
 * we skip the LLM and return the "Not in the KB" path. RRF scores are small
 * (a single rank-1 hit ≈ 1/61); this is a floor to be tuned on the golden set.
 */
const GROUNDED_MIN_SCORE = 0.016;

export type RetrievedChunk = {
  chunkId: string;
  articleId: string;
  slug: string;
  articleTitle: string;
  versionId: string;
  sectionId: string;
  sectionTitle: string;
  sectionKind: string;
  blockId: string | null;
  kind: "prose" | "code";
  text: string;
  tokenCount: number;
  score: number;
};

export type RetrievalResult = {
  chunks: RetrievedChunk[];
  grounded: boolean;
  /** "hybrid" when the question embedded; "keyword" when it fell back (§5.2 step 8). */
  mode: "hybrid" | "keyword";
  tokens: string[];
  /** Distinct articles behind the top chunks, for the "Not in the KB" suggestions. */
  nearest: { slug: string; title: string }[];
};

export type RetrieveOptions = {
  question: string;
  session: AppSession;
  limit?: number;
  /** Restrict to these articles (A2: the open article + its related set). Library-wide when omitted/empty. */
  articleIds?: string[];
};

export async function retrieveChunks(opts: RetrieveOptions): Promise<RetrievalResult> {
  const { question, session } = opts;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const role = session.role as Role;
  const tokens = extractExactTokens(question);

  const { literal: vectorLiteral, mode } = await embedQuestion(question, session);

  const visibility = searchVisibility(role, session.userId);
  const scope =
    opts.articleIds && opts.articleIds.length > 0
      ? Prisma.sql`AND ch."articleId" = ANY(ARRAY[${Prisma.join(opts.articleIds)}]::text[])`
      : Prisma.empty;

  const ctes: Prisma.Sql[] = [
    Prisma.sql`q AS (SELECT websearch_to_tsquery('english', ${question}) AS tsq)`,
    Prisma.sql`kw AS (
      SELECT ch.id, row_number() OVER (ORDER BY ts_rank(ch."searchVector", q.tsq) DESC) AS rnk
      FROM "public"."ArticleChunk" ch
      JOIN "public"."Article" a ON a.id = ch."articleId"
      CROSS JOIN q
      WHERE ch."searchVector" @@ q.tsq AND ${visibility} ${scope}
      ORDER BY ts_rank(ch."searchVector", q.tsq) DESC
      LIMIT ${POOL}
    )`,
  ];
  const unions: Prisma.Sql[] = [Prisma.sql`SELECT id, 1.0 / (60 + rnk) AS s FROM kw`];

  if (vectorLiteral) {
    ctes.push(Prisma.sql`vec AS (
      SELECT ch.id, row_number() OVER (ORDER BY ch."embedding" <=> ${vectorLiteral}::vector) AS rnk
      FROM "public"."ArticleChunk" ch
      JOIN "public"."Article" a ON a.id = ch."articleId"
      WHERE ch."embedding" IS NOT NULL AND ${visibility} ${scope}
      ORDER BY ch."embedding" <=> ${vectorLiteral}::vector
      LIMIT ${POOL}
    )`);
    unions.push(Prisma.sql`SELECT id, 1.0 / (60 + rnk) AS s FROM vec`);
  }

  if (tokens.length > 0) {
    ctes.push(Prisma.sql`exact AS (
      SELECT ch.id, row_number() OVER (ORDER BY ch."ord") AS rnk
      FROM "public"."ArticleChunk" ch
      JOIN "public"."Article" a ON a.id = ch."articleId"
      WHERE ${visibility} ${scope}
        AND EXISTS (
          SELECT 1 FROM unnest(ARRAY[${Prisma.join(tokens)}]::text[]) tok
          WHERE ch.text ILIKE '%' || tok || '%'
        )
      LIMIT ${POOL}
    )`);
    // Smaller constant → an exact code/ID match outranks a merely similar chunk.
    unions.push(Prisma.sql`SELECT id, 1.0 / (20 + rnk) AS s FROM exact`);
  }

  ctes.push(
    Prisma.sql`fused AS (
      SELECT id, SUM(s) AS score
      FROM (${Prisma.join(unions, " UNION ALL ")}) u
      GROUP BY id
    )`,
  );

  const overfetch = role === "admin" ? limit : Math.min(POOL, Math.max(limit * 3, limit));
  const rows = await prisma.$queryRaw<RetrievedChunk[]>(Prisma.sql`
    WITH ${Prisma.join(ctes, ", ")}
    SELECT
      ch.id AS "chunkId",
      ch."articleId" AS "articleId",
      a.slug AS slug,
      a.title AS "articleTitle",
      ch."versionId" AS "versionId",
      ch."sectionId" AS "sectionId",
      ch."sectionTitle" AS "sectionTitle",
      ch."sectionKind"::text AS "sectionKind",
      ch."blockId" AS "blockId",
      ch.kind::text AS kind,
      ch.text AS text,
      ch."tokenCount" AS "tokenCount",
      f.score::float8 AS score
    FROM fused f
    JOIN "public"."ArticleChunk" ch ON ch.id = f.id
    JOIN "public"."Article" a ON a.id = ch."articleId"
    ORDER BY f.score DESC, ch."articleId", ch."ord"
    LIMIT ${overfetch}
  `);

  // Authoritative per-page access gate (same as search): drop any chunk whose
  // article the user could not open directly.
  const open = await filterOpenArticleIds(
    role,
    session.userId,
    [...new Set(rows.map((row) => row.articleId))],
  );

  const chunks: RetrievedChunk[] = [];
  for (const row of rows) {
    if (!open.has(row.articleId)) continue;
    chunks.push(row);
    if (chunks.length >= limit) break;
  }

  const grounded = chunks.length > 0 && chunks[0].score >= GROUNDED_MIN_SCORE;
  return { chunks, grounded, mode, tokens, nearest: nearestArticles(chunks) };
}

/**
 * Pick the top chunks that fit a token budget (~6k, §5.2 step 6), preserving
 * fused order. The bundle sent to FastAPI is the LLM's only ground truth.
 */
export function capBundle(chunks: RetrievedChunk[], maxTokens = 6_000): RetrievedChunk[] {
  const bundle: RetrievedChunk[] = [];
  let total = 0;
  for (const chunk of chunks) {
    if (total + chunk.tokenCount > maxTokens && bundle.length > 0) break;
    bundle.push(chunk);
    total += chunk.tokenCount;
  }
  return bundle;
}

async function embedQuestion(
  question: string,
  session: AppSession,
): Promise<{ literal: string | null; mode: "hybrid" | "keyword" }> {
  const assertion = await mintIngestionAssertion(session, new Date());
  if (!assertion) return { literal: null, mode: "keyword" };
  try {
    const result = await embedTexts([question], assertion);
    const vector = result.vectors[0];
    if (!vector) return { literal: null, mode: "keyword" };
    return { literal: `[${vector.join(",")}]`, mode: "hybrid" };
  } catch (err) {
    if (err instanceof EmbedError) {
      // Fall back to keyword-only for this request (§5.2 step 8).
      console.warn(
        JSON.stringify({ event: "assistant.retrieve.embed_fallback", error: err.message }),
      );
      return { literal: null, mode: "keyword" };
    }
    throw err;
  }
}

function nearestArticles(chunks: RetrievedChunk[]): { slug: string; title: string }[] {
  const seen = new Map<string, string>();
  for (const chunk of chunks) {
    if (!seen.has(chunk.slug)) seen.set(chunk.slug, chunk.articleTitle);
    if (seen.size >= 3) break;
  }
  return [...seen].map(([slug, title]) => ({ slug, title }));
}

/** Same visibility rule as search (`lib/queries/search.ts`), for chunk rows. */
function searchVisibility(role: Role, userId: string): Prisma.Sql {
  if (can(role, "article.archive")) return Prisma.sql`TRUE`;
  if (can(role, "article.editAny")) return Prisma.sql`a.status::text <> 'archived'`;
  if (can(role, "article.editOwn")) {
    return Prisma.sql`(a.status::text = 'published' OR (a."authorId" = ${userId} AND a.status::text IN ('draft', 'in_review')))`;
  }
  return Prisma.sql`a.status::text = 'published'`;
}
