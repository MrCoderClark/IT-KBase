import { Suspense } from "react";
import { ArticleEditor } from "@/components/kb/editor/article-editor";
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
  const [categories, tags] = await Promise.all([getAllCategories(), getAllTags()]);
  return <ArticleEditor draft={blankDraft()} categories={categories} tags={tags} />;
}
