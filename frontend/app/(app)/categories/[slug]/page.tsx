import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { SessionArticleTable } from "@/components/kb/session-article-table";
import { getSession } from "@/lib/auth/session";
import { getArticlesInCategory } from "@/lib/queries/articles";

export default function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-10 text-[13px] text-fg-subtle">Loading category…</div>
      }
    >
      <CategoryArticles params={params} />
    </Suspense>
  );
}

async function CategoryArticles({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) notFound();
  const result = await getArticlesInCategory(slug, session.role, session.userId);
  if (!result) notFound();

  return (
    <ArticleListShell
      title={result.name}
      description={`${result.articles.length} ${result.articles.length === 1 ? "article" : "articles"} in this category.`}
      showCreate={false}
    >
      <SessionArticleTable
        articles={result.articles}
        emptyTitle="No articles in this category"
        emptyHint="Assign this category from the article editor."
      />
    </ArticleListShell>
  );
}
