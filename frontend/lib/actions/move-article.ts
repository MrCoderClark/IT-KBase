"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/policy";
import { wouldCreateCycle } from "@/lib/queries/article-tree";

export type MoveArticleResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Move an article to a new parent and/or position.
 * Only reviewers and admins can move articles.
 */
export async function moveArticle(
  articleId: string,
  newParentId: string | null,
  newOrder: number
): Promise<MoveArticleResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not signed in." };
  }

  if (!can(session.role, "article.publish")) {
    return { success: false, error: "You cannot move articles." };
  }

  // Validate article exists
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, parentId: true, order: true },
  });

  if (!article) {
    return { success: false, error: "Article not found." };
  }

  // Check for cycles
  if (await wouldCreateCycle(articleId, newParentId)) {
    return { success: false, error: "Cannot move an article under itself or its descendants." };
  }

  // Validate new parent exists (if specified)
  if (newParentId) {
    const parent = await prisma.article.findUnique({
      where: { id: newParentId },
      select: { id: true },
    });
    if (!parent) {
      return { success: false, error: "Parent article not found." };
    }
  }

  // If moving to the same parent, just reorder
  if (article.parentId === newParentId) {
    await reorderSiblings(articleId, newParentId, newOrder);
  } else {
    // Moving to a different parent
    // 1. Remove from old parent's ordering
    await prisma.article.updateMany({
      where: {
        parentId: article.parentId,
        order: { gt: article.order },
      },
      data: {
        order: { decrement: 1 },
      },
    });

    // 2. Make space in new parent's ordering
    await prisma.article.updateMany({
      where: {
        parentId: newParentId,
        order: { gte: newOrder },
      },
      data: {
        order: { increment: 1 },
      },
    });

    // 3. Update the article
    await prisma.article.update({
      where: { id: articleId },
      data: {
        parentId: newParentId,
        order: newOrder,
      },
    });
  }

  revalidatePath("/kb");
  revalidatePath("/");

  return { success: true };
}

/**
 * Reorder within the same parent.
 */
async function reorderSiblings(
  articleId: string,
  parentId: string | null,
  newOrder: number
): Promise<void> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { order: true },
  });

  if (!article) return;

  const oldOrder = article.order;

  if (newOrder === oldOrder) return;

  if (newOrder > oldOrder) {
    // Moving down: shift items between old and new up
    await prisma.article.updateMany({
      where: {
        parentId,
        order: { gt: oldOrder, lte: newOrder },
        id: { not: articleId },
      },
      data: {
        order: { decrement: 1 },
      },
    });
  } else {
    // Moving up: shift items between new and old down
    await prisma.article.updateMany({
      where: {
        parentId,
        order: { gte: newOrder, lt: oldOrder },
        id: { not: articleId },
      },
      data: {
        order: { increment: 1 },
      },
    });
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { order: newOrder },
  });
}
