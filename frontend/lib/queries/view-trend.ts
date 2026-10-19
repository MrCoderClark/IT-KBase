import { prisma } from "@/lib/db";

export async function listArticleViewCounts(
  articleId: string,
  fromDay: string,
): Promise<{ day: string; count: number }[]> {
  const rows = await prisma.articleView.groupBy({
    by: ["day"],
    where: { articleId, day: { gte: fromDay } },
    _count: { _all: true },
  });
  return rows.map((row) => ({ day: row.day, count: row._count._all }));
}
