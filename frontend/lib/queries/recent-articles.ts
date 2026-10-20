import { canReadArticle, type Role } from "@/lib/auth/policy";
import { prisma } from "@/lib/db";
import { articleViewerKey } from "@/lib/kb/article-views";
import { latestRecentArticles, RECENT_ARTICLE_LIMIT } from "@/lib/kb/recent-articles";
import type { ArticleStatus } from "@/lib/types/article";

const TAKE = 30;

const articleSelect = {
  slug: true,
  title: true,
  status: true,
  authorId: true,
  category: { select: { name: true } },
} as const;

/** Last articles this person opened or saved, newest first, limited to ones they may still open. */
export async function listRecentPaletteArticles(role: Role, userId: string): Promise<
  { slug: string; title: string; status: ArticleStatus; category: string | null }[]
> {
  const [views, edits] = await Promise.all([
    prisma.articleView.findMany({
      where: { viewerKey: articleViewerKey(userId, "") },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: { createdAt: true, article: { select: articleSelect } },
    }),
    prisma.articleVersion.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: { createdAt: true, article: { select: articleSelect } },
    }),
  ]);

  const touches = [...views, ...edits].flatMap((row) => {
    if (
      !canReadArticle(role, userId, {
        authorId: row.article.authorId,
        status: row.article.status,
      })
    ) {
      return [];
    }
    return [
      {
        slug: row.article.slug,
        title: row.article.title,
        status: row.article.status,
        category: row.article.category?.name ?? null,
        at: row.createdAt.toISOString(),
      },
    ];
  });

  return latestRecentArticles(touches, RECENT_ARTICLE_LIMIT).map((article) => ({
    slug: article.slug,
    title: article.title,
    status: article.status as ArticleStatus,
    category: article.category,
  }));
}
