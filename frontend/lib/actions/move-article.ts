"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/policy";
import { wouldCreateCycle } from "@/lib/queries/article-tree";

export type MoveArticleResult =
  | { success: true }
  | { success: false; error: string };

type Tx = Prisma.TransactionClient;

/**
 * Move an article to a new parent and/or sibling index.
 * Only reviewers and admins can move articles. Sibling `order` values are
 * rewritten 0..n so reorder stays stable even when older rows shared an order.
 */
export async function moveArticle(
  articleId: string,
  newParentId: string | null,
  newOrder: number,
): Promise<MoveArticleResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not signed in." };
  }

  if (!can(session.role, "article.publish")) {
    return { success: false, error: "You cannot move articles." };
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, parentId: true },
  });

  if (!article) {
    return { success: false, error: "Article not found." };
  }

  if (await wouldCreateCycle(articleId, newParentId)) {
    return { success: false, error: "Cannot move an article under itself or its descendants." };
  }

  if (newParentId) {
    const parent = await prisma.article.findUnique({
      where: { id: newParentId },
      select: { id: true },
    });
    if (!parent) {
      return { success: false, error: "Parent article not found." };
    }
  }

  const oldParentId = article.parentId;

  await prisma.$transaction(async (tx) => {
    // Park the row so sibling renumbers never collide on unique-ish order gaps.
    await tx.article.update({
      where: { id: articleId },
      data: { parentId: newParentId, order: -1 },
    });

    if (oldParentId !== newParentId) {
      await renumberSiblings(tx, oldParentId);
    }
    await renumberSiblings(tx, newParentId, articleId, newOrder);
  });

  revalidatePath("/kb");
  revalidatePath("/");

  return { success: true };
}

/**
 * Write contiguous `order` values for one sibling group.
 * When `insertId` is set, that article is placed at `insertAt` among the others.
 */
async function renumberSiblings(
  tx: Tx,
  parentId: string | null,
  insertId?: string,
  insertAt?: number,
): Promise<void> {
  const rows = await tx.article.findMany({
    where: {
      parentId,
      ...(insertId ? { id: { not: insertId } } : {}),
    },
    select: { id: true },
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });
  const ids = rows.map((row) => row.id);
  if (insertId != null && insertAt != null) {
    const clamped = Math.max(0, Math.min(insertAt, ids.length));
    ids.splice(clamped, 0, insertId);
  }
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!id) continue;
    await tx.article.update({
      where: { id },
      data: { order: i },
    });
  }
}
