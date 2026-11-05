/**
 * Rebuilds an article's `ArticleChunk` rows from its current version
 * (spec 20 §5.2). Called whenever `currentVersionId` changes (publish, restore,
 * an edit that updates current) and by the backfill command.
 *
 * Reuse: a chunk whose text is unchanged keeps its embedding, so a small edit
 * re-embeds only what changed. New or changed text is embedded through FastAPI;
 * if that call fails the chunk is still written for keyword retrieval and a
 * later run fills the vector — a rebuild never wipes good vectors to nothing.
 *
 * Vectors are written with raw SQL because Prisma has no `vector` type. The
 * keyword `searchVector` is maintained by the `ArticleChunk_search_before`
 * trigger on insert, so it needs no code here.
 */

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { mintIngestionAssertion } from "@/lib/auth/assertion";
import { prisma } from "@/lib/db";
import { appSessionForUserId } from "@/lib/ingestion/worker-session";
import { chunkVersion, type ChunkSection, type ChunkSpec } from "./chunker";
import { embedTexts } from "./embed-client";

export type ReindexResult = {
  articleId: string;
  chunks: number;
  embedded: number;
  reused: number;
  embeddingSkipped: boolean;
};

/**
 * Rebuild the chunks for one article. Safe to call repeatedly. `actorUserId`,
 * when given, is the user whose assertion embeds the chunks; otherwise (and as
 * a fallback) an admin's assertion is used. Either way the embedder only sees
 * text already in the KB.
 */
export async function reindexArticle(
  articleId: string,
  actorUserId?: string,
): Promise<ReindexResult> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { currentVersionId: true },
  });

  const base: ReindexResult = {
    articleId,
    chunks: 0,
    embedded: 0,
    reused: 0,
    embeddingSkipped: false,
  };

  // No current version (never published, archived to nothing, or deleted):
  // the article should hold no chunks.
  if (!article?.currentVersionId) {
    await prisma.articleChunk.deleteMany({ where: { articleId } });
    return base;
  }

  const sections = await loadSections(article.currentVersionId);
  const specs = chunkVersion(sections);
  if (specs.length === 0) {
    await prisma.articleChunk.deleteMany({ where: { articleId } });
    return base;
  }

  // Existing vectors, keyed by the exact text that produced them, so unchanged
  // chunks skip the embedder.
  const reusable = await loadExistingVectors(articleId);

  const toEmbed = specs.filter((spec) => !reusable.has(spec.text));
  const fresh = new Map<string, { literal: string; model: string }>();
  let embeddingSkipped = false;

  if (toEmbed.length > 0) {
    const assertion = await mintAssistantAssertion(actorUserId);
    if (!assertion) {
      // No assertion keys or no eligible user: build keyword-only chunks.
      embeddingSkipped = true;
    } else {
      try {
        const result = await embedTexts(toEmbed.map((spec) => spec.text), assertion);
        toEmbed.forEach((spec, i) => {
          const vector = result.vectors[i];
          if (vector) fresh.set(spec.text, { literal: toVectorLiteral(vector), model: result.model });
        });
      } catch (err) {
        // Keep going with keyword-only chunks; a later run embeds them.
        embeddingSkipped = true;
        console.warn(
          JSON.stringify({
            event: "assistant.index.embed_failed",
            articleId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  }

  const versionId = article.currentVersionId;
  const rows = specs.map((spec) => {
    const reused = reusable.get(spec.text);
    const made = fresh.get(spec.text);
    const vector = reused ?? made ?? null;
    return {
      spec,
      versionId,
      model: vector?.model ?? null,
      literal: vector?.literal ?? null,
    };
  });

  const createData: Prisma.ArticleChunkCreateManyInput[] = rows.map(({ spec, model }) => ({
    articleId,
    versionId,
    sectionId: spec.sectionId,
    blockId: spec.blockId,
    kind: spec.kind,
    sectionKind: spec.sectionKind,
    sectionTitle: spec.sectionTitle,
    ord: spec.ord,
    text: spec.text,
    tokenCount: spec.tokenCount,
    contentHash: contentHash(spec, model),
    embeddingModel: model,
    embeddedAt: model ? new Date() : null,
  }));

  const vectorUpdates = rows
    .filter((row) => row.literal)
    .map(
      (row) => prisma.$executeRaw`
        UPDATE "public"."ArticleChunk"
        SET "embedding" = ${row.literal}::vector
        WHERE "articleId" = ${articleId} AND "ord" = ${row.spec.ord}
      `,
    );

  await prisma.$transaction([
    prisma.articleChunk.deleteMany({ where: { articleId } }),
    prisma.articleChunk.createMany({ data: createData }),
    ...vectorUpdates,
  ]);

  return {
    articleId,
    chunks: specs.length,
    embedded: fresh.size,
    reused: rows.filter((row) => reusable.has(row.spec.text)).length,
    embeddingSkipped,
  };
}

async function loadSections(versionId: string): Promise<ChunkSection[]> {
  const sections = await prisma.section.findMany({
    where: { versionId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      kind: true,
      title: true,
      order: true,
      blocks: {
        orderBy: { order: "asc" },
        select: { id: true, order: true, content: true, code: true, imageAlt: true },
      },
    },
  });
  return sections.map((section) => ({
    id: section.id,
    kind: section.kind,
    title: section.title,
    order: section.order,
    blocks: section.blocks.map((block) => ({
      id: block.id,
      order: block.order,
      content: block.content ?? null,
      code: block.code,
      imageAlt: block.imageAlt,
    })),
  }));
}

async function loadExistingVectors(
  articleId: string,
): Promise<Map<string, { literal: string; model: string }>> {
  const rows = await prisma.$queryRaw<
    { text: string; embedding: string; embeddingModel: string | null }[]
  >(Prisma.sql`
    SELECT "text", "embedding"::text AS embedding, "embeddingModel"
    FROM "public"."ArticleChunk"
    WHERE "articleId" = ${articleId} AND "embedding" IS NOT NULL
  `);
  const map = new Map<string, { literal: string; model: string }>();
  for (const row of rows) {
    if (row.embedding) map.set(row.text, { literal: row.embedding, model: row.embeddingModel ?? "" });
  }
  return map;
}

/**
 * Mint the embed bearer: the acting user's assertion when we have one, else an
 * admin's. Returns null when `AUTH_ASSERTION_KEYS` is unset or no eligible user
 * exists, which turns embedding off (chunks are still built for keyword search).
 */
async function mintAssistantAssertion(actorUserId?: string): Promise<string | null> {
  const session =
    (actorUserId ? await appSessionForUserId(actorUserId) : null) ?? (await adminSession());
  if (!session) return null;
  return mintIngestionAssertion(session, new Date());
}

async function adminSession() {
  const admin = await prisma.user.findFirst({
    where: { role: "admin", identityId: { not: null } },
    select: { id: true },
  });
  return admin ? appSessionForUserId(admin.id) : null;
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

function contentHash(spec: ChunkSpec, model: string | null): string {
  return createHash("sha256").update(`${spec.text}\u0000${model ?? ""}`).digest("hex");
}
