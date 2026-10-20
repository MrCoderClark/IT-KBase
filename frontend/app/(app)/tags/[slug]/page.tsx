import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { SessionArticleTable } from "@/components/kb/session-article-table";
import { getSession } from "@/lib/auth/session";
import { getArticlesWithTag } from "@/lib/queries/articles";

export default function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={<div className="px-6 py-10 text-[13px] text-fg-subtle">Loading tag…</div>}
    >
      <TagArticles params={params} />
    </Suspense>
  );
}

async function TagArticles({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) notFound();
  const result = await getArticlesWithTag(slug, session.role, session.userId);
  if (!result) notFound();

  return (
    <ArticleListShell
      title={result.name}
      description={`${result.articles.length} ${result.articles.length === 1 ? "article" : "articles"} with this tag.`}
      showCreate={false}
    >
      <SessionArticleTable
        articles={result.articles}
        emptyTitle="No articles with this tag"
        emptyHint="Add this tag from the article editor."
      />
    </ArticleListShell>
  );
}
