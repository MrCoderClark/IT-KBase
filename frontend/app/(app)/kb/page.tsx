import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAllArticles } from "@/lib/queries/articles";
import ArticleTable from "@/components/kb/article-table";

/**
 * All Articles — compact sortable table with filter dropdowns and search.
 * Spec: F4 (Docs/specs/04-features.md)
 *
 * The Prisma query lives inside Suspense so Next.js 16 Cache Components
 * can prerender the static shell and stream the table.
 */
export default function AllArticlesPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight text-fg">
            All Articles
          </h1>
          <p className="mt-0.5 text-[13px] text-fg-subtle">
            Browse and manage knowledge base articles.
          </p>
        </div>
        <Link
          href="/create"
          className="
            inline-flex items-center gap-1.5 rounded-lg
            bg-accent px-3.5 py-2
            text-[13px] font-semibold text-white
            shadow-sm transition-all
            hover:bg-accent/90 hover:shadow-md
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2
          "
        >
          <Plus size={15} aria-hidden />
          New Article
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-[13px] text-fg-subtle">
            Loading articles…
          </div>
        }
      >
        <ArticleTableLoader />
      </Suspense>
    </div>
  );
}

async function ArticleTableLoader() {
  const articles = await getAllArticles();
  return <ArticleTable articles={articles} />;
}
