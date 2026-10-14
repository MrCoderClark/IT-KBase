import { Suspense } from "react";
import { SessionArticleTable } from "@/components/kb/session-article-table";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { getMyDrafts } from "@/lib/queries/articles";

export default function MyDraftsPage() {
  return (
    <Suspense fallback={<TableFallback />}>
      <DraftsLoader />
    </Suspense>
  );
}

async function DraftsLoader() {
  const session = await getSession();
  const articles = session ? await getMyDrafts(session.userId) : [];
  return (
    <ArticleListShell
      title="My Drafts"
      description="Drafts you have not published yet."
      showCreate={Boolean(session && can(session.role, "article.create"))}
    >
      <SessionArticleTable
        articles={articles}
        emptyTitle="No drafts yet"
        emptyHint="Save an article and it will show up here."
      />
    </ArticleListShell>
  );
}

function TableFallback() {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-[13px] text-fg-subtle">
      Loading drafts…
    </div>
  );
}
