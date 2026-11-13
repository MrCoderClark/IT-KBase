/**
 * Staleness triage query (spec 20 §3.3 C3) — published articles overdue for
 * review, each scanned for dated references. Server Components only (reviewer+
 * gating is enforced by the page that calls it, like the other analytics
 * queries). No model call.
 */

import { prisma } from "@/lib/db";
import { blockProseText } from "@/lib/assistant/chunker";
import {
  outdatedReferences,
  stalenessInfo,
  STALE_AFTER_DAYS,
  type OutdatedMatch,
} from "@/lib/assistant/staleness";

export interface StaleArticle {
  slug: string;
  title: string;
  updatedAt: string;
  months: number;
  outdated: OutdatedMatch[];
}

export async function getStaleArticles(now: Date, limit = 50): Promise<StaleArticle[]> {
  const cutoff = new Date(now.getTime() - STALE_AFTER_DAYS * 86_400_000);
  const rows = await prisma.article.findMany({
    where: { status: "published", updatedAt: { lt: cutoff } },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: {
      slug: true,
      title: true,
      summary: true,
      updatedAt: true,
      currentVersion: {
        select: {
          sections: {
            orderBy: { order: "asc" },
            select: {
              title: true,
              blocks: {
                orderBy: { order: "asc" },
                select: { content: true, code: true, imageAlt: true },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const parts: string[] = [row.title, row.summary ?? ""];
    for (const section of row.currentVersion?.sections ?? []) {
      parts.push(section.title);
      for (const block of section.blocks) {
        parts.push(blockProseText(block.content, block.imageAlt));
        if (block.code) parts.push(block.code);
      }
    }
    return {
      slug: row.slug,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      months: stalenessInfo(row.updatedAt, now).months,
      outdated: outdatedReferences(parts.join(" ")),
    };
  });
}
