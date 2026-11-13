/**
 * Staleness triage panel (spec 20 §3.3 C3) for the reviewer Analytics page.
 * Lists published articles overdue for review (12+ months), oldest first, with
 * the dated references found in each and what to do about them. Read-only — a
 * reviewer acts on it by opening the article to edit.
 */

import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import type { StaleArticle } from "@/lib/queries/staleness";

function age(months: number): string {
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const y = `${years} yr${years === 1 ? "" : "s"}`;
    return rest ? `${y} ${rest} mo` : y;
  }
  return `${months} mo`;
}

export function StalenessTriage({ articles }: { articles: StaleArticle[] }) {
  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-fg">
        <Clock size={15} className="text-fg-muted" aria-hidden />
        Staleness triage
      </h2>
      <p className="mt-1 text-[12px] text-fg-muted">
        Published articles not updated in 12+ months, oldest first, with dated references to review.
      </p>

      {articles.length === 0 ? (
        <p className="mt-3 rounded-lg border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
          Nothing is overdue for review. Every published article was updated within the last year.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {articles.map((article) => (
            <li
              key={article.slug}
              className="rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/kb/${article.slug}`}
                  className="text-[14px] font-semibold text-fg hover:text-accent hover:underline"
                >
                  {article.title}
                </Link>
                <span className="shrink-0 text-[12px] font-medium tabular-nums text-fg-muted">
                  Updated {age(article.months)} ago
                </span>
              </div>

              {article.outdated.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {article.outdated.map((match) => (
                      <span
                        key={match.id}
                        className="inline-flex items-center gap-1 rounded-xs border border-warning/30 bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning-fg"
                      >
                        <AlertTriangle size={11} aria-hidden />
                        {match.label}
                      </span>
                    ))}
                  </div>
                  <ul className="list-disc space-y-0.5 pl-5 text-[12px] leading-5 text-fg-muted">
                    {article.outdated.map((match) => (
                      <li key={match.id}>
                        <span className="font-medium text-fg">{match.label}:</span> {match.suggest}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-fg-subtle">
                  No dated references found — review for accuracy and refresh the date.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
