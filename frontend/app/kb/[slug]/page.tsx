import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ArticleView } from "@/app/(app)/kb/[slug]/_components/article-view";
import { AppFrame } from "@/components/layout/app-frame";
import { PublicArticle } from "@/components/kb/public-article";
import { isPublicArticle } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { getArticleBySlug } from "@/lib/queries/articles";
import { readSiteSettings } from "@/lib/settings/store";

/**
 * Article read lives outside the signed-in layout so a published public
 * article can render with no session. Every other slug still requires login.
 */
export default function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ArticleEntry params={params} />
    </Suspense>
  );
}

async function ArticleEntry({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, session, settings] = await Promise.all([
    getArticleBySlug(slug),
    getSession(),
    readSiteSettings(),
  ]);

  if (session) {
    if (!article) notFound();
    return (
      <AppFrame session={session} settings={settings}>
        <ArticleView params={params} />
      </AppFrame>
    );
  }

  if (article && isPublicArticle(article)) {
    return <PublicArticle article={article} />;
  }

  redirect(`/login?next=${encodeURIComponent(`/kb/${slug}`)}`);
}
