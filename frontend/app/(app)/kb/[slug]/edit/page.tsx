import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArticleEditor } from "@/components/kb/editor/article-editor";
import { articleToDraft } from "@/lib/editor/draft";
import {
  getAllCategories,
  getAllTags,
  getArticleBySlug,
} from "@/lib/queries/articles";

export default function EditArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-10 text-[13px] text-fg-subtle">Loading editor…</div>
      }
    >
      <EditEditor params={params} />
    </Suspense>
  );
}

async function EditEditor({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, categories, tags] = await Promise.all([
    getArticleBySlug(slug),
    getAllCategories(),
    getAllTags(),
  ]);
  if (!article) notFound();

  return (
    <ArticleEditor
      draft={articleToDraft(article)}
      categories={categories}
      tags={tags}
    />
  );
}
