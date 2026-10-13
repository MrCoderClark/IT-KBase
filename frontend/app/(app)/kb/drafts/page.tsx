import { Suspense } from "react";
import { getMyDrafts } from "@/lib/queries/articles";
import ArticleTable from "@/components/kb/article-table";
import { ArticleListShell } from "@/components/kb/article-list-shell";

export default function MyDraftsPage() {
  return (
    <ArticleListShell
      title="My Drafts"
      description="Drafts you have not published yet."
    >
      <Suspense fallback={<TableFallback />}>
        <DraftsLoader />
      </Suspense>
    </ArticleListShell>
  );
}

async function DraftsLoader() {
  const articles = await getMyDrafts();
  return (
    <ArticleTable
      articles={articles}
      emptyTitle="No drafts yet"
      emptyHint="Save an article and it will show up here."
    />
  );
}

function TableFallback() {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-[13px] text-fg-subtle">
      Loading drafts…
    </div>
  );
}
