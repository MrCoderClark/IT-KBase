import { Suspense } from "react";
import { AccessDenied } from "@/components/auth/access-denied";
import { FeedbackNotes } from "@/components/kb/article-feedback";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { canReviewArticleFeedback } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
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
  if (!session || !canReviewArticleFeedback(session.role)) {
    return (
      <AccessDenied
        title="Analytics"
        detail="Only a reviewer or an admin can read article votes."
      />
    );
  }
  const notes = await listRecentFeedback();
  return (
    <ArticleListShell
      title="Analytics"
      description="Recent helpful and not-helpful votes. Charts come later."
      showCreate={false}
    >
      <FeedbackNotes notes={notes} showArticle />
    </ArticleListShell>
  );
}
