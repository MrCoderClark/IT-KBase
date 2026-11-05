/**
 * One-time backfill: build assistant chunks (and embeddings, when configured)
 * for every article that has a current version (spec 20 §5.2, step 3). Safe to
 * re-run — unchanged chunks reuse their vectors, so a second run embeds nothing.
 *
 *   cd frontend
 *   pnpm assistant:backfill
 */

import { reindexArticle } from "../lib/assistant/indexer";
import { prisma } from "../lib/db";
import { ensureIngestOtel } from "../lib/otel/ingest";
import { loadEnvFiles } from "./load-env";

loadEnvFiles();
ensureIngestOtel();

async function main() {
  if (!process.env.AUTH_ASSERTION_KEYS?.trim()) {
    console.warn(
      "AUTH_ASSERTION_KEYS is not set — chunks will be built for keyword search only, with no vectors.",
    );
  }

  const articles = await prisma.article.findMany({
    where: { currentVersionId: { not: null } },
    select: { id: true, slug: true },
    orderBy: { updatedAt: "asc" },
  });

  console.info(`Backfilling ${articles.length} article(s).`);
  let chunks = 0;
  let embedded = 0;
  let skipped = 0;

  for (const article of articles) {
    const result = await reindexArticle(article.id);
    chunks += result.chunks;
    embedded += result.embedded;
    if (result.embeddingSkipped) skipped += 1;
    console.info(
      JSON.stringify({
        slug: article.slug,
        chunks: result.chunks,
        embedded: result.embedded,
        reused: result.reused,
        embeddingSkipped: result.embeddingSkipped,
      }),
    );
  }

  console.info(
    `Done: ${articles.length} article(s), ${chunks} chunk(s), ${embedded} newly embedded` +
      (skipped ? `, ${skipped} article(s) left without vectors (embedder unavailable).` : "."),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
