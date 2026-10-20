import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/auth/access-denied";
import { ArticleEditor } from "@/components/kb/editor/article-editor";
import { canEditArticle } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { articleToDraft } from "@/lib/editor/draft";
import {
  getAllCategories,
  getAllTags,
  getArticleBySlug,
} from "@/lib/queries/articles";

export default function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-10 text-[13px] text-fg-subtle">Loading editor…</div>
      }
    >
      <EditEditor params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditEditor({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [article, categories, tags, session] = await Promise.all([
    getArticleBySlug(slug),
    getAllCategories(),
    getAllTags(),
    getSession(),
  ]);
  if (!article) notFound();
  if (
    !session ||
    !article.author.id ||
    !canEditArticle(session.role, session.userId, {
      authorId: article.author.id,
      status: article.status,
    })
  ) {
    return (
      <AccessDenied
        title="You cannot edit this article"
        detail="Authors can edit their own drafts. Reviewers can edit any draft and publish. Admins can also archive."
      />
    );
  }

  return (
    <ArticleEditor
      draft={articleToDraft(article)}
      categories={categories}
      tags={tags}
      role={session.role}
      notice={
        query.notice === "imported"
          ? "Drafted from a Word document. Review the sections, then save or publish."
          : null
      }
    />
  );
}
