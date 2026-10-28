import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/auth/access-denied";
import { ArticleContent } from "@/components/kb/article-content";
import { ArticleHeader } from "@/components/kb/article-header";
import { ArticleRightRail } from "@/components/kb/article-right-rail";
import { ArticleToc } from "@/components/kb/article-toc";
import { Breadcrumbs } from "@/components/kb/breadcrumbs";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { RestoreVersionForm } from "@/app/(app)/kb/[slug]/history/_components/restore-version-form";
import { VersionCompare } from "@/app/(app)/kb/[slug]/history/_components/version-compare";
import { can, canReadArticleHistory } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { compareSections } from "@/lib/kb/section-compare";
import { getArticleVersion, getRelatedArticles, listArticleVersions } from "@/lib/queries/articles";

export default function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string; compare?: string; notice?: string; from?: string; to?: string; e?: string }>;
}) {
  return (
    <Suspense fallback={<ArticleListShell title="History" description="Loading versions…" showCreate={false}><div /></ArticleListShell>}>
      <HistoryPanel params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function HistoryPanel({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string; compare?: string; notice?: string; from?: string; to?: string; e?: string }>;
}) {
  const session = await getSession();
  if (!session || !canReadArticleHistory(session.role)) {
    return (
      <AccessDenied
        title="History"
        detail="Only a reviewer or an admin can open older versions."
      />
    );
  }

  const { slug } = await params;
  const query = await searchParams;
  const canRestore = can(session.role, "article.rollback");
  if (query.v && query.compare === "1") {
    return <VersionDiff slug={slug} version={query.v} canRestore={canRestore} />;
  }
  if (query.v) return <VersionRead slug={slug} version={query.v} canRestore={canRestore} />;
  return <VersionList slug={slug} notice={historyNotice(query)} />;
}

function historyNotice(query: { notice?: string; from?: string; to?: string; e?: string }): string | null {
  if (query.e === "current") return "That version is already current.";
  if (query.e === "missing") return "That version was not found.";
  if (query.e === "role") return "Only an admin can restore a version.";
  if (query.notice === "restored" && isVersion(query.from) && isVersion(query.to)) {
    return `Restored ${query.from} as ${query.to}. Older versions are still in this list.`;
  }
  return null;
}

function isVersion(value: string | undefined): value is string {
  return Boolean(value && /^\d+\.\d+$/.test(value));
}

async function VersionList({ slug, notice }: { slug: string; notice: string | null }) {
  const history = await listArticleVersions(slug);
  if (!history) notFound();

  return (
    <ArticleListShell
      title="History"
      description={`${history.title}. Current version is ${history.currentVersion}.`}
      showCreate={false}
    >
      {notice ? <p className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-[13px] text-fg">{notice}</p> : null}
      <p className="mb-4 text-[13px]">
        <Link href={`/kb/${history.slug}`} className="font-semibold text-accent hover:underline">
          Back to the article
        </Link>
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
              <th className="px-4 py-2 font-semibold">Version</th>
              <th className="px-4 py-2 font-semibold">Saved</th>
              <th className="px-4 py-2 font-semibold">Author</th>
              <th className="px-4 py-2 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {history.versions.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 font-semibold">
                  <Link
                    href={`/kb/${history.slug}/history?v=${encodeURIComponent(row.version)}`}
                    className="tabular-nums text-accent hover:underline"
                  >
                    {row.version}
                  </Link>
                  {row.current ? (
                    <span className="ml-2 text-[12px] font-medium text-fg-muted">Current</span>
                  ) : (
                    <Link
                      href={`/kb/${history.slug}/history?v=${encodeURIComponent(row.version)}&compare=1`}
                      className="ml-3 text-[12px] font-medium text-fg-muted hover:text-accent hover:underline"
                    >
                      Compare
                    </Link>
                  )}
                </td>
                <td className="px-4 py-3 text-fg-muted">{when(row.createdAt)}</td>
                <td className="px-4 py-3 text-fg">{row.authorName}</td>
                <td className="px-4 py-3 text-fg-muted">{row.notes ?? "Saved"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ArticleListShell>
  );
}

async function VersionRead({
  slug,
  version,
  canRestore,
}: {
  slug: string;
  version: string;
  canRestore: boolean;
}) {
  const snap = await getArticleVersion(slug, version);
  if (!snap) notFound();
  const session = await getSession();
  const related = session
    ? await getRelatedArticles(snap.article, session.role, session.userId)
    : await getRelatedArticles(snap.article);
  const historyHref = `/kb/${snap.article.slug}/history`;

  return (
    <div className="w-full px-6 py-6">
      <p className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-[13px] text-fg">
        Viewing {snap.article.version}. Current is {snap.currentVersion}.{" "}
        <Link href={historyHref} className="font-semibold text-accent hover:underline">
          All versions
        </Link>
        {" · "}
        <Link href={`/kb/${snap.article.slug}`} className="font-semibold text-accent hover:underline">
          Current article
        </Link>
        {snap.article.version === snap.currentVersion ? null : (
          <>
            {" · "}
            <Link
              href={`/kb/${snap.article.slug}/history?v=${encodeURIComponent(snap.article.version)}&compare=1`}
              className="font-semibold text-accent hover:underline"
            >
              Compare with current
            </Link>
          </>
        )}
      </p>
      {canRestore && snap.article.version !== snap.currentVersion ? (
        <RestoreVersionForm slug={snap.article.slug} version={snap.article.version} />
      ) : null}
      <Breadcrumbs
        segments={[
          { label: "Knowledge Base", href: "/kb" },
          { label: "History", href: historyHref },
        ]}
      />
      <div className="mt-5">
        <ArticleHeader article={snap.article} canEdit={false} />
      </div>
      <div className="mt-8 flex items-start gap-6">
        <ArticleToc sections={snap.article.sections} />
        <ArticleContent article={snap.article} />
        <ArticleRightRail article={snap.article} related={related} historyHref={historyHref} />
      </div>
    </div>
  );
}

async function VersionDiff({
  slug,
  version,
  canRestore,
}: {
  slug: string;
  version: string;
  canRestore: boolean;
}) {
  const selected = await getArticleVersion(slug, version);
  if (!selected) notFound();
  if (selected.article.version === selected.currentVersion) {
    return (
      <ArticleListShell title="Compare" description="This is already the current version." showCreate={false}>
        <Link href={`/kb/${slug}/history`} className="text-[13px] font-semibold text-accent hover:underline">
          All versions
        </Link>
      </ArticleListShell>
    );
  }
  const current = await getArticleVersion(slug, selected.currentVersion);
  if (!current) notFound();
  return (
    <VersionCompare
      slug={slug}
      currentVersion={selected.currentVersion}
      selectedVersion={selected.article.version}
      rows={compareSections(current.article.sections, selected.article.sections)}
      canRestore={canRestore}
    />
  );
}
