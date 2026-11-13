/**
 * Coverage report panel (spec 20 §3.3 C5) for the reviewer Analytics page.
 * Open knowledge gaps — questions the assistant couldn't answer from the KB —
 * ranked by demand, with headline stats. Read-only; a reviewer acts on a gap by
 * authoring the missing article.
 */

import { HelpCircle } from "lucide-react";
import { coverageStats, ACTIVE_WINDOW_DAYS, type GapRow } from "@/lib/assistant/coverage";

function askedWhen(lastAskedAt: string): string {
  const date = new Date(lastAskedAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CoverageReport({ gaps, now }: { gaps: GapRow[]; now: Date }) {
  const stats = coverageStats(gaps, now);

  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-fg">
        <HelpCircle size={15} className="text-fg-muted" aria-hidden />
        Coverage gaps
      </h2>
      <p className="mt-1 text-[12px] text-fg-muted">
        Questions the assistant couldn&apos;t answer from the KB, ranked by how often they&apos;re asked.
      </p>

      {gaps.length === 0 ? (
        <p className="mt-3 rounded-lg border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
          No open coverage gaps. Every question the assistant has seen was answered from the KB.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[12px] text-fg-muted tabular-nums">
            {stats.openCount} open {stats.openCount === 1 ? "gap" : "gaps"} · {stats.totalAsks}{" "}
            {stats.totalAsks === 1 ? "ask" : "asks"} · {stats.activeThisMonth} active in the last{" "}
            {ACTIVE_WINDOW_DAYS} days
          </p>
          <ol className="mt-3 flex flex-col gap-2">
            {gaps.map((gap) => (
              <li
                key={gap.normalized}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-fg">{gap.sampleQuestion}</p>
                  <p className="mt-0.5 text-[12px] text-fg-subtle">Last asked {askedWhen(gap.lastAskedAt)}</p>
                </div>
                <span className="shrink-0 rounded-xs bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent tabular-nums">
                  asked {gap.askCount}×
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
