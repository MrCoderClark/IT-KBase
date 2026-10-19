import { trendDays } from "./view-trend";

export type StatusCounts = {
  total: number;
  published: number;
  inReview: number;
  draft: number;
  archived: number;
};

/** First UTC day of a window that ends today and is `days` long. */
export function windowStartDay(now: Date, days: number): string {
  const window = trendDays(now, days);
  return window[0] ?? trendDays(now, 1)[0] ?? "";
}

/** Published and in-review articles last touched before this instant are stale. */
export function staleCutoff(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()));
}

export function countStatuses(rows: { status: string; count: number }[]): StatusCounts {
  const counts: StatusCounts = { total: 0, published: 0, inReview: 0, draft: 0, archived: 0 };
  for (const row of rows) {
    counts.total += row.count;
    if (row.status === "published") counts.published += row.count;
    else if (row.status === "in_review") counts.inReview += row.count;
    else if (row.status === "draft") counts.draft += row.count;
    else if (row.status === "archived") counts.archived += row.count;
  }
  return counts;
}

/** `day` keys are `yyyymmdd`, so a string compare is chronological. */
export function opensSince(rows: { day: string; count: number }[], fromDay: string): number {
  return rows.reduce((sum, row) => (row.day >= fromDay ? sum + row.count : sum), 0);
}
