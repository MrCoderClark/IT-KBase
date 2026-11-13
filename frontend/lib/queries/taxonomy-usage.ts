/**
 * Tag usage query (spec 20 §3.3 C6) — every tag with its article count, for the
 * admin taxonomy-hygiene report. Server Components only; admin gating is enforced
 * by the page that calls it. Counts include all articles (admin sees everything).
 * No model call.
 */

import { prisma } from "@/lib/db";
import type { TagUsage } from "@/lib/assistant/taxonomy";

export async function getTagUsage(): Promise<TagUsage[]> {
  const rows = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: { name: true, slug: true, _count: { select: { articles: true } } },
  });
  return rows.map((row) => ({ name: row.name, slug: row.slug, count: row._count.articles }));
}
