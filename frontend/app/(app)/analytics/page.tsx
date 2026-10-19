import { Suspense } from "react";
import { AccessDenied } from "@/components/auth/access-denied";
import { AnalyticsDashboardView } from "@/components/kb/analytics-dashboard";
import { FeedbackNotes } from "@/components/kb/article-feedback";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { canReadArticleAnalytics } from "@/lib/auth/policy";
import { getSession, requestTime } from "@/lib/auth/session";
import { getAnalyticsDashboard } from "@/lib/queries/dashboard";
import { listRecentFeedback } from "@/lib/queries/feedback";

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
  const [dashboard, notes] = await Promise.all([
    getAnalyticsDashboard(await requestTime()),
    listRecentFeedback(),
  ]);
  return (
    <ArticleListShell
      title="Analytics"
      description="Article counts, recent unique opens, and votes. A 30-day trend is also on each article."
      showCreate={false}
    >
      <AnalyticsDashboardView dashboard={dashboard} />
      <h2 className="mt-6 text-[13px] font-semibold text-fg">Recent votes</h2>
      <div className="mt-2">
        <FeedbackNotes notes={notes} showArticle />
      </div>
    </ArticleListShell>
  );
}
