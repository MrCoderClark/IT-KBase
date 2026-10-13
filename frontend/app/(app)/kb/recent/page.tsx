import { Suspense } from "react";
import { getRecentlyUpdated } from "@/lib/queries/articles";
import ArticleTable from "@/components/kb/article-table";
import { ArticleListShell } from "@/components/kb/article-list-shell";

export default function RecentlyUpdatedPage() {
  return (
    <ArticleListShell
      title="Recently Updated"
      description="Articles still in the library, newest first."
    >
      <Suspense fallback={<TableFallback />}>
        <RecentLoader />
      </Suspense>
    </ArticleListShell>
  );
}

async function RecentLoader() {
  const articles = await getRecentlyUpdated();
  return (
    <ArticleTable
      articles={articles}
      emptyTitle="No articles yet"
      emptyHint="Create an article and it will show up here."
    />
  );
}

function TableFallback() {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-[13px] text-fg-subtle">
      Loading articles…
    </div>
  );
}
