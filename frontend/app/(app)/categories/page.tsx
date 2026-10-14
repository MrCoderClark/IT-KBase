import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { CategoryAdmin } from "@/components/kb/category-admin";
import { getCategoryIndex } from "@/lib/queries/articles";

export default function CategoriesPage() {
  return (
    <Suspense
      fallback={
        <ArticleListShell
          title="Categories"
          description="Browse articles by the system they belong to."
          showCreate={false}
        >
          <ListFallback />
        </ArticleListShell>
      }
    >
      <CategoryIndex />
    </Suspense>
  );
}

async function CategoryIndex() {
  const categories = await getCategoryIndex();
  return <CategoryAdmin categories={categories} />;
}

function ListFallback() {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-[13px] text-fg-subtle">
      Loading categories…
    </div>
  );
}
