import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { TaxonomyList } from "@/components/kb/taxonomy-list";
import { getCategoryIndex } from "@/lib/queries/articles";

export default function CategoriesPage() {
  return (
    <ArticleListShell
      title="Categories"
      description="Browse articles by the system they belong to."
      showCreate={false}
    >
      <Suspense fallback={<ListFallback label="Loading categories…" />}>
        <CategoryIndex />
      </Suspense>
    </ArticleListShell>
  );
}

async function CategoryIndex() {
  const categories = await getCategoryIndex();
  return (
    <TaxonomyList
      emptyTitle="No categories yet"
      items={categories.map((category) => ({
        name: category.name,
        href: `/categories/${category.slug}`,
        count: category.count,
      }))}
    />
  );
}

function ListFallback({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-[13px] text-fg-subtle">
      {label}
    </div>
  );
}
