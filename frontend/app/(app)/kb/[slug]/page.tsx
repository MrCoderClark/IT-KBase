import { Suspense } from "react";
import { ArticleView } from "./_components/article-view";

/**
 * Signed-in article read. This page stays inside the app layout so a click
 * from the sidebar or the article list updates the content in place.
 * Anonymous public reads are rewritten to /p/[slug] by proxy.ts.
 */
export default function ArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string; e?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-10 text-[13px] text-fg-subtle">Loading article…</div>
      }
    >
      <ArticleView params={params} searchParams={searchParams} />
    </Suspense>
  );
}
