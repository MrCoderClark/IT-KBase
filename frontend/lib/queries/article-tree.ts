import { cache } from "react";
import { canReadArticle, type ArticleStatus, type Role } from "@/lib/auth/policy";
import { prisma } from "@/lib/db";
import { readableWhere } from "@/lib/queries/articles";

/**
 * A node in the article tree. Children are nested recursively.
 */
export type ArticleTreeNode = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "in_review" | "published" | "archived";
  parentId: string | null;
  order: number;
  children: ArticleTreeNode[];
};

/**
 * Fetch all articles with tree fields, then build the nested structure.
 * For <100 articles, this is simpler than recursive CTEs.
 */
export const getArticleTree = cache(async (role: Role, userId: string): Promise<ArticleTreeNode[]> => {
  const articles = await prisma.article.findMany({
    where: {
      AND: [readableWhere(role, userId), { status: { not: "archived" } }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      parentId: true,
      order: true,
    },
    orderBy: [{ parentId: "asc" }, { order: "asc" }, { title: "asc" }],
  });

  return buildTree(articles);
});

/**
 * Build a nested tree from a flat list of articles.
 */
function buildTree(
  articles: {
    id: string;
    slug: string;
    title: string;
    status: "draft" | "in_review" | "published" | "archived";
    parentId: string | null;
    order: number;
  }[]
): ArticleTreeNode[] {
  const map = new Map<string, ArticleTreeNode>();
  const roots: ArticleTreeNode[] = [];

  // First pass: create all nodes
  for (const article of articles) {
    map.set(article.id, {
      ...article,
      children: [],
    });
  }

  // Second pass: build parent-child relationships
  for (const article of articles) {
    const node = map.get(article.id)!;
    if (article.parentId && map.has(article.parentId)) {
      map.get(article.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by order at each level
  const sortChildren = (nodes: ArticleTreeNode[]) => {
    nodes.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  return roots;
}

/**
 * Get ancestors of an article (for breadcrumbs), ordered from root to immediate parent.
 */
export const getArticleAncestors = cache(
  async (
    articleId: string,
    role: Role,
    userId: string,
  ): Promise<{ id: string; slug: string; title: string }[]> => {
    const ancestors: { id: string; slug: string; title: string }[] = [];

    let currentId: string | null = articleId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) break; // cycle protection
      visited.add(currentId);

      const article: {
        id: string;
        slug: string;
        title: string;
        parentId: string | null;
        status: ArticleStatus;
        authorId: string;
      } | null = await prisma.article.findUnique({
        where: { id: currentId },
        select: { id: true, slug: true, title: true, parentId: true, status: true, authorId: true },
      });

      if (!article) break;
      if (
        article.id !== articleId &&
        canReadArticle(role, userId, { authorId: article.authorId, status: article.status })
      ) {
        ancestors.unshift({ id: article.id, slug: article.slug, title: article.title });
      }
      currentId = article.parentId;
    }

    return ancestors;
  }
);

/**
 * Check if making `articleId` a child of `newParentId` would create a cycle.
 */
export async function wouldCreateCycle(
  articleId: string,
  newParentId: string | null
): Promise<boolean> {
  if (!newParentId) return false;
  if (articleId === newParentId) return true;

  // Walk up from newParentId; if we hit articleId, it's a cycle
  let currentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) return true; // existing cycle
    if (currentId === articleId) return true;
    visited.add(currentId);

    const article: { parentId: string | null } | null = await prisma.article.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });

    currentId = article?.parentId ?? null;
  }

  return false;
}
