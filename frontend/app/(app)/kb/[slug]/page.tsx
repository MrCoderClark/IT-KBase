import { Suspense } from "react";
import { SEED_ARTICLES } from "@/lib/seed/articles";
import { ArticleView } from "./_components/article-view";

export function generateStaticParams() {
  return Object.keys(SEED_ARTICLES).map((slug) => ({ slug }));
}

export default function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense>
      <ArticleView params={params} />
    </Suspense>
  );
}
