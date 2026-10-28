import ArticleTable from "@/components/kb/article-table";
import { getSession } from "@/lib/auth/session";
import type { ArticleFacetFilters } from "@/lib/kb/article-filters";
import type { Article, ArticleCategory } from "@/lib/types/article";

export async function SessionArticleTable({
  articles,
  emptyTitle,
  emptyHint,
  categories,
  facets,
  syncFacetsToUrl = false,
}: {
  articles: Article[];
  emptyTitle?: string;
  emptyHint?: string;
  categories?: ArticleCategory[];
  facets?: ArticleFacetFilters;
  /** When true, facet changes rewrite `/kb?…` and the server re-queries. */
  syncFacetsToUrl?: boolean;
}) {
  const session = await getSession();
  return (
    <ArticleTable
      articles={articles}
      emptyTitle={emptyTitle}
      emptyHint={emptyHint}
      actor={session ? { role: session.role, userId: session.userId } : null}
      categories={categories}
      facets={facets}
      syncFacetsToUrl={syncFacetsToUrl}
    />
  );
}
