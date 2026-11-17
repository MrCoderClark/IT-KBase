/**
 * Dump the current published-article inventory so fixtures can target real
 * slugs. Run from `frontend/`:
 *
 *   pnpm tsx --tsconfig tsconfig.json scripts/retrieval-eval/list-articles.ts
 *
 * Prints one line per article:  <slug>  [<category-slug>]  <title>
 * Then a count. Nothing more.
 */

import { prisma } from "../../lib/db";
import { loadEnvFiles } from "../load-env";

loadEnvFiles();

async function main() {
  const articles = await prisma.article.findMany({
    where: { status: "published" },
    select: {
      slug: true,
      title: true,
      category: { select: { slug: true } },
    },
    orderBy: { slug: "asc" },
  });
  for (const a of articles) {
    const cat = a.category?.slug ?? "-";
    console.log(`${a.slug}  [${cat}]  ${a.title}`);
  }
  console.log(`\n${articles.length} published articles`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
