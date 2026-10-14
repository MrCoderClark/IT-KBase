import { Suspense } from "react";
import { AccessDenied } from "@/components/auth/access-denied";
import { ArticleEditor } from "@/components/kb/editor/article-editor";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { blankDraft } from "@/lib/editor/draft";
import { getAllCategories, getAllTags } from "@/lib/queries/articles";

export default function CreateArticlePage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-10 text-[13px] text-fg-subtle">Loading editor…</div>
      }
    >
      <CreateEditor />
    </Suspense>
  );
}

async function CreateEditor() {
  const session = await getSession();
  if (!session || !can(session.role, "article.create")) {
    return (
      <AccessDenied
        title="You cannot create articles"
        detail="Your role can read the knowledge base. An author, reviewer, or admin can create a draft."
      />
    );
  }
  const [categories, tags] = await Promise.all([getAllCategories(), getAllTags()]);
  return <ArticleEditor draft={blankDraft()} categories={categories} tags={tags} role={session.role} />;
}
