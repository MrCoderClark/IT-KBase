import { prisma } from "@/lib/db";
import { countStatuses, opensSince, staleCutoff, windowStartDay, type StatusCounts } from "@/lib/kb/dashboard";
import type { ArticleStatus } from "@/lib/types/article";

export type DashboardArticle = {
  title: string;
  slug: string;
  views: number;
  status: ArticleStatus;
  updatedAt: string;
};

export type AnalyticsDashboard = {
  counts: StatusCounts;
  opens7: number;
  opens30: number;
  top: DashboardArticle[];
  stale: DashboardArticle[];
};

export async function getAnalyticsDashboard(now: Date): Promise<AnalyticsDashboard> {
  const from30 = windowStartDay(now, 30);
  const from7 = windowStartDay(now, 7);
  const [statusRows, viewRows, top, stale] = await Promise.all([
    prisma.article.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.articleView.groupBy({
      by: ["day"],
      where: { day: { gte: from30 } },
      _count: { _all: true },
    }),
    prisma.article.findMany({
      orderBy: [{ views: "desc" }, { title: "asc" }],
      take: 5,
      select: { title: true, slug: true, views: true, status: true, updatedAt: true },
    }),
    prisma.article.findMany({
      where: {
        status: { in: ["published", "in_review"] },
        updatedAt: { lt: staleCutoff(now) },
      },
      orderBy: { updatedAt: "asc" },
      take: 8,
      select: { title: true, slug: true, views: true, status: true, updatedAt: true },
    }),
  ]);

  const opens = viewRows.map((row) => ({ day: row.day, count: row._count._all }));
  return {
    counts: countStatuses(statusRows.map((row) => ({ status: row.status, count: row._count._all }))),
    opens7: opensSince(opens, from7),
    opens30: opensSince(opens, from30),
    top: top.map(toArticle),
    stale: stale.map(toArticle),
  };
}

function toArticle(row: {
  title: string;
  slug: string;
  views: number;
  status: ArticleStatus;
  updatedAt: Date;
}): DashboardArticle {
  return {
    title: row.title,
    slug: row.slug,
    views: row.views,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}
