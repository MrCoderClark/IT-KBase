"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function deleteArticle(articleId: string): Promise<string | void> {
  const session = await getSession();
  if (!session || !can(session.role, "article.delete")) {
    return "You cannot delete articles.";
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, _count: { select: { children: true } } },
  });
  if (!article) redirect("/kb");
  if (article._count.children > 0) {
    return "Move or delete child pages first.";
  }

  await prisma.$transaction([
    prisma.article.update({
      where: { id: articleId },
      data: { currentVersionId: null, draftVersionId: null },
    }),
    prisma.ingestionJob.deleteMany({ where: { articleId } }),
    prisma.article.delete({ where: { id: articleId } }),
  ]);

  revalidatePath("/kb");
  redirect("/kb");
}
