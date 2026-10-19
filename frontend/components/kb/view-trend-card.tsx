import { helpfulRatioLabel, sparklinePoints, trendSummary, type TrendPoint } from "@/lib/kb/view-trend";

const WIDTH = 260;
const HEIGHT = 36;

/** Reviewer view of the last 30 UTC days. Lifetime views stay in Article Details. */
export function ViewTrendCard({
  points,
  helpful,
  notHelpful,
}: {
  points: TrendPoint[];
  helpful: number;
  notHelpful: number;
}) {
  const summary = trendSummary(points);
  const pointsAttr = sparklinePoints(
    points.map((point) => point.count),
    WIDTH,
    HEIGHT,
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-[16px] leading-6 font-semibold text-fg">Last 30 days</h3>
      <p className="mt-1 text-[13px] leading-5 text-fg-muted">{summary}</p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-3 h-9 w-full text-accent"
        role="img"
        aria-label={summary}
      >
        <polyline
          points={pointsAttr}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <p className="mt-3 text-[12px] font-semibold text-fg-subtle">Helpful votes</p>
      <p className="mt-0.5 text-[13px] leading-5 text-fg">{helpfulRatioLabel(helpful, notHelpful)}</p>
    </section>
  );
}
