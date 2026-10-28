import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { TagAdmin } from "@/components/kb/tag-admin";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { getTagIndex } from "@/lib/queries/articles";

export default function TagsPage() {
  return (
    <Suspense
      fallback={
        <ArticleListShell
          title="Tags"
          description="Browse articles by topic."
          showCreate={false}
        >
          <ListFallback />
        </ArticleListShell>
      }
    >
      <TagIndex />
    </Suspense>
  );
}

async function TagIndex() {
  const session = await getSession();
  const tags = session ? await getTagIndex(session.role, session.userId) : [];
  return (
    <TagAdmin
      tags={tags}
      canManage={Boolean(session && can(session.role, "admin.manage"))}
    />
  );
}

function ListFallback() {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-[13px] text-fg-subtle">
      Loading tags…
    </div>
  );
}
