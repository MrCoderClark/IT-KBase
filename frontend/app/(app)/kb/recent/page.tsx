import { Suspense } from "react";
import { SessionArticleTable } from "@/components/kb/session-article-table";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { getRecentlyUpdated } from "@/lib/queries/articles";

export default function RecentlyUpdatedPage() {
  return (
    <Suspense fallback={<TableFallback />}>
      <RecentLoader />
    </Suspense>
  );
}

async function RecentLoader() {
  const session = await getSession();
  const articles = session ? await getRecentlyUpdated(session.role, session.userId) : [];
  return (
    <ArticleListShell
      title="Recently Updated"
      description="Articles still in the library, newest first."
      showCreate={Boolean(session && can(session.role, "article.create"))}
    >
      <SessionArticleTable
        articles={articles}
        emptyTitle="No articles yet"
        emptyHint="Create an article and it will show up here."
      />
    </ArticleListShell>
  );
}

function TableFallback() {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-[13px] text-fg-subtle">
      Loading articles…
    </div>
  );
}
