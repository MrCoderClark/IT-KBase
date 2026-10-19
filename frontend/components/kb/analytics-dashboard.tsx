import Link from "next/link";
import { StatusChip } from "@/components/kb/status-chip";
import type { AnalyticsDashboard, DashboardArticle } from "@/lib/queries/dashboard";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function AnalyticsDashboardView({ dashboard }: { dashboard: AnalyticsDashboard }) {
  const { counts } = dashboard;
  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-5">
        <Stat label="Total" value={counts.total} />
        <Stat label="Published" value={counts.published} />
        <Stat label="In review" value={counts.inReview} />
        <Stat label="Drafts" value={counts.draft} />
        <Stat label="Archived" value={counts.archived} />
      </section>

      <section className="rounded-xl border border-border bg-surface px-4 py-3">
        <h2 className="text-[13px] font-semibold text-fg">Unique opens</h2>
        <p className="mt-1 text-[13px] text-fg">
          <span className="tabular-nums font-semibold">{dashboard.opens7.toLocaleString("en-US")}</span>
          <span className="text-fg-muted"> in 7 days</span>
          <span className="mx-2 text-fg-subtle">·</span>
          <span className="tabular-nums font-semibold">{dashboard.opens30.toLocaleString("en-US")}</span>
          <span className="text-fg-muted"> in 30 days</span>
        </p>
        <p className="mt-1 text-[12px] leading-5 text-fg-subtle">
          One open per viewer per UTC day, since view counting shipped. Lifetime totals stay on each article.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ArticleTable
          title="Top articles"
          empty="No articles yet."
          rows={dashboard.top}
          metric="views"
        />
        <ArticleTable
          title="Not updated in 12 months"
          empty="No published or in-review article is older than 12 months."
          rows={dashboard.stale}
          metric="updated"
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <p className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">{label}</p>
      <p className="mt-0.5 text-[20px] leading-6 font-semibold tabular-nums text-fg">
        {value.toLocaleString("en-US")}
      </p>
    </div>
  );
}

function ArticleTable({
  title,
  empty,
  rows,
  metric,
}: {
  title: string;
  empty: string;
  rows: DashboardArticle[];
  metric: "views" | "updated";
}) {
  return (
    <section className="rounded-xl border border-border bg-surface px-4 py-3">
      <h2 className="text-[13px] font-semibold text-fg">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-fg-muted">{empty}</p>
      ) : (
        <table className="mt-2 w-full text-[13px]">
          <tbody>
            {rows.map((article) => (
              <tr key={article.slug} className="border-t border-border first:border-t-0">
                <td className="py-1.5 pr-3">
                  <Link href={`/kb/${article.slug}`} className="font-medium text-fg hover:text-accent hover:underline">
                    {article.title}
                  </Link>
                </td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  {metric === "views" ? (
                    <span className="tabular-nums text-fg">{article.views.toLocaleString("en-US")}</span>
                  ) : (
                    <span className="text-fg-muted">{formatWhen(article.updatedAt)}</span>
                  )}
                </td>
                <td className="py-1.5 pl-3 text-right">
                  <StatusChip status={article.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
