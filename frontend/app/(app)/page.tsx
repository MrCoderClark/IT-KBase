import Link from "next/link";
import { ArrowRight, FileText, Sparkles, Upload } from "lucide-react";

/**
 * Home — temporary shell shakedown screen. Validates:
 *   - breadcrumb-sized headings on canvas
 *   - card surfaces with the design-system radii / shadows
 *   - primary and secondary buttons on light canvas
 *   - 3-column layout fits under the 280px sidebar on common widths
 *
 * This is NOT the final Home. It gets replaced once Article Detail (M1)
 * and the real Home brief exist.
 */
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 py-10">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-[11px] leading-4 font-semibold tracking-[0.08em] uppercase text-fg-subtle">
            Welcome back
          </div>
          <h1 className="mt-1 text-[28px] leading-9 font-bold tracking-tight text-fg">
            Joe, here&rsquo;s what&rsquo;s moving in the KB today.
          </h1>
          <p className="mt-2 max-w-[640px] text-[15px] leading-6 text-fg-muted">
            Drop a Word doc or PDF to turn it into a structured runbook, or
            jump straight to the articles your team touched this week.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/import"
            className="inline-flex h-9 items-center gap-2 rounded-sm bg-accent px-3.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
          >
            <Upload size={16} aria-hidden />
            Import file
          </Link>
          <Link
            href="/create"
            className="inline-flex h-9 items-center gap-2 rounded-sm border border-border-strong bg-surface px-3.5 text-[14px] font-semibold text-fg transition-colors hover:bg-surface-muted"
          >
            New article
          </Link>
        </div>
      </div>

      {/* Stat tiles */}
      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile label="Published articles" value="248" delta="+6 this week" />
        <StatTile label="Drafts awaiting review" value="12" delta="2 ready" />
        <StatTile label="Articles stale > 12 mo" value="31" delta="−4 vs last mo" tone="warning" />
      </section>

      {/* Two-column: recent + ingestion CTA */}
      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-[16px] leading-6 font-semibold text-fg">
                Recently updated
              </h2>
              <p className="text-[12px] leading-4 text-fg-subtle">
                Articles your team touched in the last 7 days
              </p>
            </div>
            <Link
              href="/kb/recent"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
            >
              View all
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {SAMPLE_RECENT.map((row) => (
              <li
                key={row.title}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                <FileText
                  size={18}
                  className="shrink-0 text-fg-subtle"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] leading-5 font-medium text-fg">
                    {row.title}
                  </div>
                  <div className="truncate text-[12px] leading-4 text-fg-subtle">
                    {row.category} · updated {row.updated} by {row.author}
                  </div>
                </div>
                <span className="shrink-0 rounded-xs border border-accent-soft bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-sm bg-accent-soft text-accent">
            <Sparkles size={18} aria-hidden />
          </div>
          <h2 className="text-[16px] leading-6 font-semibold text-fg">
            Draft from a document
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-fg-muted">
            Upload a Word doc or PDF and get a structured article in under a
            minute. You review and publish; the AI drafts.
          </p>
          <Link
            href="/import"
            className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-sm bg-accent px-3.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
          >
            <Upload size={16} aria-hidden />
            Start import
          </Link>
        </aside>
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  delta,
  tone = "neutral",
}: {
  label: string;
  value: string;
  delta: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="text-[11px] leading-4 font-semibold tracking-[0.08em] uppercase text-fg-subtle">
        {label}
      </div>
      <div className="mt-1 text-[28px] leading-9 font-bold tabular-nums text-fg">
        {value}
      </div>
      <div
        className={
          tone === "warning"
            ? "mt-1 text-[12px] leading-4 font-medium text-warning"
            : "mt-1 text-[12px] leading-4 font-medium text-fg-subtle"
        }
      >
        {delta}
      </div>
    </div>
  );
}

const SAMPLE_RECENT = [
  {
    title: "Windows 11 — Resetting the Local Administrator Password",
    category: "Windows",
    author: "Joe Clark",
    updated: "2h ago",
    status: "Published",
  },
  {
    title: "Entra ID — Conditional Access break-glass procedure",
    category: "Security",
    author: "Priya Shah",
    updated: "Yesterday",
    status: "In Review",
  },
  {
    title: "Intune — Autopilot enrollment fails with error 0x80180014",
    category: "Windows",
    author: "Sam Reyes",
    updated: "2d ago",
    status: "Draft",
  },
  {
    title: "Ubuntu 24.04 — Rotating root SSH keys across the fleet",
    category: "Linux",
    author: "Joe Clark",
    updated: "3d ago",
    status: "Published",
  },
  {
    title: "M365 — Shared mailbox not appearing in Outlook on the web",
    category: "M365",
    author: "Priya Shah",
    updated: "4d ago",
    status: "Published",
  },
] as const;
