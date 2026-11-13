/**
 * Miscategorization input (spec 20 §3.3 C6) — published, categorized articles
 * with a short text excerpt, plus the full category list the model may suggest
 * from. Server Components / BFF only; admin gating is enforced by the caller.
 * No model call — this just assembles what the reviewer is asked to judge.
 */

import { prisma } from "@/lib/db";
import { blockProseText } from "@/lib/assistant/chunker";

const EXCERPT_LIMIT = 1_500;

export interface ReviewArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  categorySlug: string;
  categoryName: string;
  excerpt: string;
}

export interface CategoryOption {
  slug: string;
  name: string;
}

export interface MiscategorizedInput {
  articles: ReviewArticle[];
  categories: CategoryOption[];
}

export async function getMiscategorizedInput(limit = 60): Promise<MiscategorizedInput> {
  const [rows, categories] = await Promise.all([
    prisma.article.findMany({
      where: { status: "published", categoryId: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        category: { select: { name: true, slug: true } },
        currentVersion: {
          select: {
            sections: {
              orderBy: { order: "asc" },
              select: {
                title: true,
                blocks: {
                  orderBy: { order: "asc" },
                  select: { content: true, imageAlt: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { name: true, slug: true },
    }),
  ]);

  const articles: ReviewArticle[] = [];
  for (const row of rows) {
    const category = row.category;
    if (!category) continue; // categoryId was non-null, but keep the type honest
    const parts: string[] = [];
    for (const section of row.currentVersion?.sections ?? []) {
      parts.push(section.title);
      for (const block of section.blocks) parts.push(blockProseText(block.content, block.imageAlt));
    }
    articles.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary ?? "",
      categorySlug: category.slug,
      categoryName: category.name,
      excerpt: parts.join(" ").replace(/\s+/g, " ").trim().slice(0, EXCERPT_LIMIT),
    });
  }

  return { articles, categories };
}
