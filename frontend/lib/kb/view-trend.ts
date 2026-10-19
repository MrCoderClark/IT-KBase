import { viewDay } from "./article-views";

export const TREND_DAYS = 30;

export type TrendPoint = {
  day: string;
  count: number;
};

/** UTC days ending on `now`, oldest first. */
export function trendDays(now: Date, length = TREND_DAYS): string[] {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days: string[] = [];
  for (let offset = length - 1; offset >= 0; offset -= 1) {
    days.push(viewDay(new Date(start - offset * 86_400_000)));
  }
  return days;
}

/** Missing days count as zero so the chart stays 30 points wide. */
export function fillTrend(days: string[], counts: Iterable<{ day: string; count: number }>): TrendPoint[] {
  const byDay = new Map<string, number>();
  for (const row of counts) byDay.set(row.day, row.count);
  return days.map((day) => ({ day, count: byDay.get(day) ?? 0 }));
}

export function formatTrendDay(day: string): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(4, 6));
  const date = Number(day.slice(6, 8));
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function trendSummary(points: TrendPoint[]): string {
  const total = points.reduce((sum, point) => sum + point.count, 0);
  if (total === 0) return "No views in the last 30 days.";
  const views = total === 1 ? "1 view" : `${total.toLocaleString("en-US")} views`;
  const peak = Math.max(...points.map((point) => point.count));
  const peaks = points.filter((point) => point.count === peak);
  if (peaks.length !== 1) return `${views} in the last 30 days.`;
  return `${views} in the last 30 days. Most on ${formatTrendDay(peaks[0].day)} (${peak}).`;
}

export function helpfulRatioLabel(helpful: number, notHelpful: number): string {
  const total = helpful + notHelpful;
  if (total <= 0) return "No votes yet.";
  const percent = Math.round((helpful / total) * 100);
  return `${percent}% helpful · ${helpful.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}`;
}

/** Polyline in a `width` by `height` box. Zero sits on the bottom edge. */
export function sparklinePoints(counts: number[], width: number, height: number): string {
  const max = Math.max(1, ...counts);
  const last = Math.max(counts.length - 1, 1);
  return counts
    .map((count, index) => {
      const x = (index / last) * width;
      const y = height - (count / max) * height;
      return `${trim(x)},${trim(y)}`;
    })
    .join(" ");
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}
