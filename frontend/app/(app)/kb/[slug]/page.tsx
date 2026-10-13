import { Suspense } from "react";
import { ArticleView } from "./_components/article-view";

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
