import { Suspense } from "react";
import { AccessDenied } from "@/components/auth/access-denied";
import { ArticleEditor } from "@/components/kb/editor/article-editor";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { blankDraft } from "@/lib/editor/draft";
import { getAllCategories, getAllTags } from "@/lib/queries/articles";
import { prisma } from "@/lib/db";

export default function CreateArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ parentId?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-10 text-[13px] text-fg-subtle">Loading editor…</div>
      }
    >
      <CreateEditor searchParams={searchParams} />
    </Suspense>
  );
}

async function CreateEditor({
  searchParams,
}: {
  searchParams: Promise<{ parentId?: string }>;
}) {
  const [session, query] = await Promise.all([getSession(), searchParams]);
  if (!session || !can(session.role, "article.create")) {
    return (
      <AccessDenied
        title="You cannot create articles"
        detail="Your role can read the knowledge base. An author, reviewer, or admin can create a draft."
      />
    );
  }

  // Validate parentId if provided
  let parentId: string | null = null;
  let parentTitle: string | null = null;
  if (query.parentId) {
    const parent = await prisma.article.findUnique({
      where: { id: query.parentId },
      select: { id: true, title: true },
    });
    if (parent) {
      parentId = parent.id;
      parentTitle = parent.title;
    }
  }

  const [categories, tags] = await Promise.all([getAllCategories(), getAllTags()]);
  return (
    <ArticleEditor
      draft={blankDraft(parentId)}
      categories={categories}
      tags={tags}
      role={session.role}
      parentTitle={parentTitle}
    />
  );
}
