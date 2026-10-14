import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";

export default function SharedWithMePage() {
  return (
    <Suspense
      fallback={
        <ArticleListShell title="Shared With Me" description="Articles waiting on your review." showCreate={false}>
          <div />
        </ArticleListShell>
      }
    >
      <SharedBody />
    </Suspense>
  );
}

async function SharedBody() {
  const session = await getSession();
  return (
    <ArticleListShell
      title="Shared With Me"
      description="Articles waiting on your review."
      showCreate={Boolean(session && can(session.role, "article.create"))}
    >
      <div className="rounded-xl border border-border bg-surface px-4 py-16 text-center">
        <p className="text-[13px] font-medium text-fg-muted">Nothing is shared with you yet.</p>
        <p className="mt-0.5 text-[12px] text-fg-subtle">
          Articles sent for review will appear here.
        </p>
      </div>
    </ArticleListShell>
  );
}
