import { notFound } from "next/navigation";
import { ArticleFeedbackNotes } from "@/components/kb/article-feedback";
import { canEditArticle, canReadArticleAnalytics, canReadArticleHistory, canReviewArticleFeedback } from "@/lib/auth/policy";
import { getSession, requestTime } from "@/lib/auth/session";
import { fillTrend, trendDays, type TrendPoint } from "@/lib/kb/view-trend";
import { getArticleBySlug, getRelatedArticles } from "@/lib/queries/articles";
import { getArticleAncestors } from "@/lib/queries/article-tree";
import { listArticleViewCounts } from "@/lib/queries/view-trend";
import { Breadcrumbs, type BreadcrumbSegment } from "@/components/kb/breadcrumbs";
import { ArticleHeader } from "@/components/kb/article-header";
import { ArticleToc } from "@/components/kb/article-toc";
import { ArticleContent } from "@/components/kb/article-content";
import { RecordArticleView } from "@/components/kb/record-article-view";
import { ArticleRightRail } from "@/components/kb/article-right-rail";

function feedbackNotice(query: { notice?: string; e?: string }): string | null {
  if (query.notice === "feedback") return "Thanks. Your vote is saved.";
  if (query.e === "wait") return "You already voted on this article this week.";
  if (query.e === "comment") return "Keep the comment to 500 characters.";
  if (query.e === "vote") return "Choose helpful or not helpful.";
  return null;
}

/**
 * Inner async component that awaits params inside Suspense.
 * Next.js 16 requires URL data (params) to be resolved inside a
 * Suspense boundary so navigation stays instant.
 *
 * Data is fetched from Postgres via Prisma.
 */
export async function ArticleView({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; e?: string }>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const [article, session] = await Promise.all([getArticleBySlug(slug), getSession()]);

  if (!article) notFound();

  const [related, ancestors] = await Promise.all([
    getRelatedArticles(article),
    getArticleAncestors(article.id),
  ]);
  let trend: TrendPoint[] | null = null;
  if (session && canReadArticleAnalytics(session.role)) {
    const days = trendDays(await requestTime());
    const fromDay = days[0];
    if (fromDay) trend = fillTrend(days, await listArticleViewCounts(article.id, fromDay));
  }
  const canEdit = Boolean(
    session &&
      article.author.id &&
      canEditArticle(session.role, session.userId, {
        authorId: article.author.id,
        status: article.status,
      }),
  );

  return (
    <div className="w-full px-6 py-6">
      <RecordArticleView articleId={article.id} />
      <Breadcrumbs
        segments={[
          { label: "Knowledge Base", href: "/kb" },
          ...ancestors.map((a): BreadcrumbSegment => ({
            label: a.title,
            href: `/kb/${a.slug}`,
          })),
          { label: article.title },
        ]}
      />

      <div className="mt-5">
        <ArticleHeader article={article} canEdit={canEdit} />
      </div>

      <div className="mt-8 flex items-start gap-6">
        <ArticleToc sections={article.sections} />
        <div className="min-w-0 flex-1">
          <ArticleContent article={article} />
          {session && canReviewArticleFeedback(session.role) ? (
            <details className="mt-2 rounded-xl border border-border bg-canvas px-4 py-3">
              <summary className="cursor-pointer text-[13px] font-semibold text-fg">Feedback notes</summary>
              <div className="mt-3">
                <ArticleFeedbackNotes articleId={article.id} />
              </div>
            </details>
          ) : null}
        </div>
        <ArticleRightRail
          article={article}
          related={related}
          canEdit={canEdit}
          historyHref={session && canReadArticleHistory(session.role) ? `/kb/${article.slug}/history` : undefined}
          feedbackNotice={feedbackNotice(query)}
          trend={trend}
        />
      </div>
    </div>
  );
}
