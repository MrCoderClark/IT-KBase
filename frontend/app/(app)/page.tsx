import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, FileText, Sparkles, Upload } from "lucide-react";
import { StatusChip } from "@/components/kb/status-chip";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { getHomeBrief } from "@/lib/queries/articles";
import type { Article } from "@/lib/types/article";

/**
 * Home brief. The greeting, import link, counts, and recent list read
 * Postgres inside Suspense (`cacheComponents`).
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
            <Suspense fallback="Welcome back">
              <HomeGreeting />
            </Suspense>
          </h1>
          <p className="mt-2 max-w-[640px] text-[15px] leading-6 text-fg-muted">
            <Suspense fallback="Open an article your team published recently.">
              <HomeLede />
            </Suspense>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Suspense fallback={null}>
            <ImportLink />
          </Suspense>
          <Suspense fallback={null}>
            <NewArticleLink />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<HomeFallback />}>
        <HomeBrief />
      </Suspense>
    </div>
  );
}

async function HomeGreeting() {
  const session = await getSession();
  const first = session?.name.split(" ")[0] ?? "there";
  return <>{first}, here&rsquo;s what&rsquo;s moving in the KB.</>;
}

async function HomeLede() {
  const session = await getSession();
  if (session && can(session.role, "article.create")) {
    return (
      <>
        Drop a Word doc or PDF to turn it into a structured runbook, or open an
        article your team updated recently.
      </>
    );
  }
  return <>Open an article your team published recently.</>;
}

async function ImportLink() {
  const session = await getSession();
  if (!session || !can(session.role, "article.create")) return null;
  return (
    <Link
      href="/import"
      className="inline-flex h-9 items-center gap-2 rounded-sm bg-accent px-3.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
    >
      <Upload size={16} aria-hidden />
      Import file
    </Link>
  );
}

async function NewArticleLink() {
  const session = await getSession();
  if (!session || !can(session.role, "article.create")) return null;
  return (
    <Link
      href="/create"
      className="inline-flex h-9 items-center gap-2 rounded-sm border border-border-strong bg-surface px-3.5 text-[14px] font-semibold text-fg transition-colors hover:bg-surface-muted"
    >
      <FileText size={16} aria-hidden />
      New article
    </Link>
  );
}

async function HomeBrief() {
  const session = await getSession();
  if (!session) return null;
  const brief = await getHomeBrief(session.role, session.userId);
  const now = new Date();
  const canCreate = can(session.role, "article.create");
  const showDrafts = can(session.role, "article.editOwn");

  return (
    <>
      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile label="Published articles" value={brief.published} hint="Currently published" />
        {showDrafts ? (
          <StatTile
            label="Your drafts"
            value={brief.drafts}
            hint="Open drafts"
            href="/kb/drafts"
          />
        ) : null}
        {showDrafts ? (
          <StatTile label="In review" value={brief.inReview} hint="Marked in review" />
        ) : null}
      </section>

      <section
        className={
          canCreate
            ? "mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]"
            : "mt-8"
        }
      >
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-[16px] leading-6 font-semibold text-fg">
                Recently updated
              </h2>
              <p className="text-[12px] leading-4 text-fg-subtle">
                Five newest articles still in the library
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
          {brief.recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-fg-subtle">
              No articles yet.
              {canCreate ? (
                <>
                  {" "}
                  <Link href="/create" className="font-medium text-accent hover:underline">
                    Create one
                  </Link>
                </>
              ) : null}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {brief.recent.map((article) => (
                <RecentRow key={article.id} article={article} now={now} />
              ))}
            </ul>
          )}
        </div>

        {canCreate ? <ImportCard /> : null}
      </section>
    </>
  );
}

function RecentRow({ article, now }: { article: Article; now: Date }) {
  const category = article.category?.name ?? "Uncategorized";
  const updated = relativeUpdated(article.updatedAt, now);
  return (
    <li>
      <Link
        href={`/kb/${article.slug}`}
        className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-muted"
      >
        <FileText size={18} className="shrink-0 text-fg-subtle" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] leading-5 font-medium text-fg">
            {article.title}
          </div>
          <div className="truncate text-[12px] leading-4 text-fg-subtle">
            {category} · updated {updated} by {article.author.name}
          </div>
        </div>
        <StatusChip status={article.status} />
      </Link>
    </li>
  );
}

function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="text-[11px] leading-4 font-semibold tracking-[0.08em] uppercase text-fg-subtle">
        {label}
      </div>
      <div className="mt-1 text-[28px] leading-9 font-bold tabular-nums text-fg">
        {value}
      </div>
      <div
        className={
          href
            ? "mt-1 text-[12px] leading-4 font-medium text-accent"
            : "mt-1 text-[12px] leading-4 font-medium text-fg-subtle"
        }
      >
        {hint}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors hover:bg-surface-muted"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      {body}
    </div>
  );
}

function ImportCard() {
  return (
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
  );
}

function HomeFallback() {
  return (
    <div className="mt-8 rounded-xl border border-border bg-surface px-5 py-10 text-center text-[13px] text-fg-subtle">
      Loading the brief…
    </div>
  );
}

function relativeUpdated(iso: string, now: Date): string {
  const then = new Date(iso);
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
