/**
 * Sanity-check hybrid retrieval against the seed data (spec 20 §5.2) without
 * the LLM or the UI. Prints the ranked, permission-filtered chunks for a
 * question, as a given user (default: an admin).
 *
 *   cd frontend
 *   pnpm assistant:query "Autopilot fails with 0x80180014"
 *   pnpm assistant:query "reset a local admin password" sarah.kim@techbase.local
 *   # scope to one article + its related set (A2), by slug:
 *   pnpm assistant:query "does this work on Windows 10?" "" windows-11-resetting-local-administrator-password
 */

import { Prisma } from "@prisma/client";
import { appSessionForUserId } from "../lib/ingestion/worker-session";
import { resolveArticleScope } from "../lib/assistant/article-scope";
import { retrieveChunks } from "../lib/assistant/retrieval";
import { prisma } from "../lib/db";
import { ensureIngestOtel } from "../lib/otel/ingest";
import { loadEnvFiles } from "./load-env";

loadEnvFiles();
ensureIngestOtel();

async function main() {
  const args = process.argv.slice(2);
  const question = args[0];
  // Order-independent: the arg with "@" is the user email, any other is the
  // article slug (pnpm drops empty-string placeholders, so don't rely on them).
  const email = args.slice(1).find((a) => a.includes("@"));
  const articleSlug = args.slice(1).find((a) => a && !a.includes("@"));
  if (!question) {
    console.error('Usage: pnpm assistant:query "<question>" [userEmail] [articleSlug]');
    process.exit(1);
  }

  const user = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
  if (!user) {
    console.error(email ? `No user with email ${email}.` : "No admin user found.");
    process.exit(1);
  }
  const session = await appSessionForUserId(user.id);
  if (!session) {
    console.error("That user has no linked identity (cannot mint an assertion).");
    process.exit(1);
  }

  const [counts] = await prisma.$queryRaw<{ total: number; embedded: number }[]>(Prisma.sql`
    SELECT count(*)::int AS total, count("embedding")::int AS embedded
    FROM "public"."ArticleChunk"
  `);
  console.info(`chunks in DB: ${counts.total} total, ${counts.embedded} with embeddings`);

  let articleIds: string[] | undefined;
  if (articleSlug) {
    const article = await prisma.article.findUnique({
      where: { slug: articleSlug },
      select: { id: true },
    });
    if (!article) {
      console.error(`No article with slug ${articleSlug}.`);
      process.exit(1);
    }
    articleIds = await resolveArticleScope(article.id);
    console.info(`scope: article "${articleSlug}" + related → ${articleIds.length} article(s)`);
  }

  const result = await retrieveChunks({ question, session, articleIds });
  console.info(
    `\nQ: ${question}\nas: ${session.email} (${session.role})\n` +
      `mode: ${result.mode}  grounded: ${result.grounded}  ` +
      `tokens: [${result.tokens.join(", ")}]  hits: ${result.chunks.length}\n`,
  );
  result.chunks.forEach((chunk, i) => {
    const text = chunk.text.replace(/\s+/g, " ").slice(0, 100);
    console.info(
      `${String(i + 1).padStart(2)}. ${chunk.score.toFixed(4)}  [${chunk.kind}] ` +
        `${chunk.slug} §${chunk.sectionTitle}\n      ${text}${chunk.text.length > 100 ? "…" : ""}`,
    );
  });
  if (!result.grounded) {
    console.info(
      `\nNot grounded. Nearest: ${result.nearest.map((n) => n.slug).join(", ") || "(none)"}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
