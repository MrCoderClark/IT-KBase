import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PublicArticle } from "@/components/kb/public-article";
import { canOpenPublicArticle } from "@/lib/auth/policy";
import { getArticleBySlug } from "@/lib/queries/articles";
import { effectiveArticleAccess } from "@/lib/queries/page-access";

/**
 * Anonymous read. proxy.ts rewrites /kb/[slug] here when there is no session.
 * The browser URL stays /kb/[slug].
 */
export default function PublicArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <PublicEntry params={params} />
    </Suspense>
  );
}

async function PublicEntry({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  const effective = await effectiveArticleAccess(article.id);
  if (!canOpenPublicArticle(article, effective.mode)) {
    redirect(`/login?next=${encodeURIComponent(`/kb/${slug}`)}`);
  }
  return <PublicArticle article={article} />;
}
