import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { TaxonomyList } from "@/components/kb/taxonomy-list";
import { getTagIndex } from "@/lib/queries/articles";

export default function TagsPage() {
  return (
    <ArticleListShell
      title="Tags"
      description="Browse articles by topic."
      showCreate={false}
    >
      <Suspense fallback={<ListFallback />}>
        <TagIndex />
      </Suspense>
    </ArticleListShell>
  );
}

async function TagIndex() {
  const tags = await getTagIndex();
  return (
    <TaxonomyList
      emptyTitle="No tags yet"
      items={tags.map((tag) => ({
        name: tag.name,
        href: `/tags/${tag.slug}`,
        count: tag.count,
      }))}
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
