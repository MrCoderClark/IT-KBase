import { Suspense } from "react";
import { getAllArticles } from "@/lib/queries/articles";
import ArticleTable from "@/components/kb/article-table";
import { ArticleListShell } from "@/components/kb/article-list-shell";

/**
 * All Articles — compact sortable table with filter dropdowns and search.
 * Spec: F4 (Docs/specs/04-features.md)
 *
 * The Prisma query lives inside Suspense so Next.js 16 Cache Components
 * can prerender the static shell and stream the table.
 */
export default function AllArticlesPage() {
  return (
    <ArticleListShell
      title="All Articles"
      description="Browse and manage knowledge base articles."
    >
      <Suspense fallback={<TableFallback />}>
        <ArticleTableLoader />
      </Suspense>
    </ArticleListShell>
  );
}

async function ArticleTableLoader() {
  const articles = await getAllArticles();
  return <ArticleTable articles={articles} />;
}

function TableFallback() {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-[13px] text-fg-subtle">
      Loading articles…
    </div>
  );
}
