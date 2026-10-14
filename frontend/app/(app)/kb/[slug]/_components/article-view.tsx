import { notFound } from "next/navigation";
import { getArticleBySlug, getRelatedArticles } from "@/lib/queries/articles";
import { Breadcrumbs } from "@/components/kb/breadcrumbs";
import { ArticleHeader } from "@/components/kb/article-header";
import { ArticleToc } from "@/components/kb/article-toc";
import { ArticleContent } from "@/components/kb/article-content";
import { ArticleRightRail } from "@/components/kb/article-right-rail";

/**
 * Inner async component that awaits params inside Suspense.
 * Next.js 16 requires URL data (params) to be resolved inside a
 * Suspense boundary so navigation stays instant.
 *
 * Data is fetched from Postgres via Prisma.
 */
export async function ArticleView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) notFound();

  const related = await getRelatedArticles(article);

  return (
    <div className="w-full px-6 py-6">
      <Breadcrumbs
        segments={[
          { label: "Knowledge Base", href: "/kb" },
          { label: "Articles", href: "/kb" },
        ]}
      />

      <div className="mt-5">
        <ArticleHeader article={article} />
      </div>

      <div className="mt-8 flex items-start gap-6">
        <ArticleToc sections={article.sections} />
        <ArticleContent article={article} />
        <ArticleRightRail article={article} related={related} />
      </div>
    </div>
  );
}
