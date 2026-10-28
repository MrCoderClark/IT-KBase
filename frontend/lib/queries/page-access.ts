import { cache } from "react";
import {
  canOpenArticle,
  type Role,
} from "@/lib/auth/policy";
import { prisma } from "@/lib/db";
import {
  type ArticleAccessMode,
  type EffectivePageAccess,
  type PageAccessNode,
  passesPageGate,
  resolveEffectiveAccess,
} from "@/lib/kb/page-access";

export type PageAccessIndex = Map<string, PageAccessNode>;

/** All articles' access fields — small-library approach from the spec. */
export const loadPageAccessIndex = cache(async (): Promise<PageAccessIndex> => {
  const rows = await prisma.article.findMany({
    select: {
      id: true,
      parentId: true,
      title: true,
      accessMode: true,
      accessRoleFloor: true,
    },
  });
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        parentId: row.parentId,
        title: row.title,
        accessMode: row.accessMode as ArticleAccessMode,
        accessRoleFloor: row.accessRoleFloor,
      },
    ]),
  );
});

export async function effectiveArticleAccess(
  articleId: string,
): Promise<EffectivePageAccess> {
  const index = await loadPageAccessIndex();
  return resolveEffectiveAccess(articleId, index);
}

export async function articlePassesPageAccess(
  role: Role,
  userId: string,
  article: { id: string; authorId: string; status: "draft" | "in_review" | "published" | "archived" },
): Promise<boolean> {
  const effective = await effectiveArticleAccess(article.id);
  return canOpenArticle(role, userId, article, passesPageGate(role, effective));
}

/** Drop list rows the principal cannot open under page access. */
export async function filterArticlesByPageAccess<
  T extends { id: string; authorId?: string; author?: { id?: string }; status: string },
>(role: Role, userId: string, articles: T[]): Promise<T[]> {
  if (articles.length === 0) return articles;
  if (role === "admin") return articles;

  const index = await loadPageAccessIndex();
  return articles.filter((article) => {
    const authorId = article.authorId ?? article.author?.id;
    if (!authorId) return false;
    const effective = resolveEffectiveAccess(article.id, index);
    return canOpenArticle(
      role,
      userId,
      { authorId, status: article.status as "draft" | "in_review" | "published" | "archived" },
      passesPageGate(role, effective),
    );
  });
}

/** Keep only article ids the principal may open (search hits, related, etc.). */
export async function filterOpenArticleIds(
  role: Role,
  userId: string,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  if (role === "admin") return new Set(ids);

  const [index, rows] = await Promise.all([
    loadPageAccessIndex(),
    prisma.article.findMany({
      where: { id: { in: ids } },
      select: { id: true, authorId: true, status: true },
    }),
  ]);
  const open = new Set<string>();
  for (const row of rows) {
    const effective = resolveEffectiveAccess(row.id, index);
    if (
      canOpenArticle(role, userId, row, passesPageGate(role, effective))
    ) {
      open.add(row.id);
    }
  }
  return open;
}
