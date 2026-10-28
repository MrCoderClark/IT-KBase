import { Suspense } from "react";
import { SessionArticleTable } from "@/components/kb/session-article-table";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { can, listableStatuses } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { parseArticleFacets } from "@/lib/kb/article-filters";
import { getAllArticles, getCategoryIndex } from "@/lib/queries/articles";

/**
 * All Articles — compact sortable table with filter dropdowns and search.
 * Spec: F4 / F7 (Docs/specs/04-features.md)
 *
 * Category, status, and updated-within live in the URL and narrow the
 * Prisma query (and FTS when searching). The Prisma query lives inside
 * Suspense so Next.js Cache Components can stream the table.
 */
export default function AllArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; updated?: string }>;
}) {
  return (
    <Suspense fallback={<TableFallback />}>
      <ArticleTableLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function ArticleTableLoader({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; updated?: string }>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const facets = session
    ? parseArticleFacets(params, listableStatuses(session.role))
    : parseArticleFacets(params);
  const [articles, categoryRows] = session
    ? await Promise.all([
        getAllArticles(session.role, session.userId, facets),
        getCategoryIndex(session.role, session.userId),
      ])
    : [[], []];
  const categories = categoryRows.map((row) => ({
    name: row.name,
    slug: row.slug,
    color: row.color,
  }));
  return (
    <ArticleListShell
      title="All Articles"
      description="Browse and manage knowledge base articles."
      showCreate={Boolean(session && can(session.role, "article.create"))}
    >
      <SessionArticleTable
        articles={articles}
        categories={categories}
        facets={facets}
        syncFacetsToUrl
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
