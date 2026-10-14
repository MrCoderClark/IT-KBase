import ArticleTable from "@/components/kb/article-table";
import { getSession } from "@/lib/auth/session";
import type { Article } from "@/lib/types/article";

export async function SessionArticleTable({
  articles,
  emptyTitle,
  emptyHint,
}: {
  articles: Article[];
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const session = await getSession();
  return (
    <ArticleTable
      articles={articles}
      emptyTitle={emptyTitle}
      emptyHint={emptyHint}
      actor={session ? { role: session.role, userId: session.userId } : null}
    />
  );
}
