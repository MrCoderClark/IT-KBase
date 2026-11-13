import { Suspense } from "react";
import { AccessDenied } from "@/components/auth/access-denied";
import { AnalyticsDashboardView } from "@/components/kb/analytics-dashboard";
import { FeedbackNotes } from "@/components/kb/article-feedback";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { StalenessTriage } from "@/components/kb/staleness-triage";
import { CoverageReport } from "@/components/kb/coverage-report";
import { canReadArticleAnalytics } from "@/lib/auth/policy";
import { getSession, requestTime } from "@/lib/auth/session";
import { getAnalyticsDashboard } from "@/lib/queries/dashboard";
import { listRecentFeedback } from "@/lib/queries/feedback";
import { getStaleArticles } from "@/lib/queries/staleness";
import { getCoverageGaps } from "@/lib/queries/coverage";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<ArticleListShell title="Analytics" description="Loading votes…" showCreate={false}><div /></ArticleListShell>}>
      <AnalyticsPanel />
    </Suspense>
  );
}

async function AnalyticsPanel() {
  const session = await getSession();
  if (!session || !canReadArticleAnalytics(session.role)) {
    return (
      <AccessDenied
        title="Analytics"
        detail="Only a reviewer or an admin can open Analytics."
      />
    );
  }
  const now = await requestTime();
  const [dashboard, notes, stale, gaps] = await Promise.all([
    getAnalyticsDashboard(now),
    listRecentFeedback(),
    getStaleArticles(now),
    getCoverageGaps(),
  ]);
  return (
    <ArticleListShell
      title="Analytics"
      description="Article counts, recent unique opens, and votes. A 30-day trend is also on each article."
      showCreate={false}
    >
      <AnalyticsDashboardView dashboard={dashboard} />
      <StalenessTriage articles={stale} />
      <CoverageReport gaps={gaps} now={now} />
      <h2 className="mt-6 text-[13px] font-semibold text-fg">Recent votes</h2>
      <div className="mt-2">
        <FeedbackNotes notes={notes} showArticle />
      </div>
    </ArticleListShell>
  );
}
