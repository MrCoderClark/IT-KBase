import { Suspense } from "react";
import { SessionArticleTable } from "@/components/kb/session-article-table";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { getAllArticles } from "@/lib/queries/articles";

/**
 * All Articles — compact sortable table with filter dropdowns and search.
 * Spec: F4 (Docs/specs/04-features.md)
 *
 * The Prisma query lives inside Suspense so Next.js 16 Cache Components
 * can prerender the static shell and stream the table.
 */
export default function AllArticlesPage() {
  return (
    <Suspense fallback={<TableFallback />}>
      <ArticleTableLoader />
    </Suspense>
  );
}

async function ArticleTableLoader() {
  const session = await getSession();
  const articles = session ? await getAllArticles(session.role, session.userId) : [];
  return (
    <ArticleListShell
      title="All Articles"
      description="Browse and manage knowledge base articles."
      showCreate={Boolean(session && can(session.role, "article.create"))}
    >
      <SessionArticleTable articles={articles} />
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
