"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/policy";
import { getSession, requestTime } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { feedbackComment, feedbackIsCooling } from "@/lib/kb/feedback";

export async function submitArticleFeedback(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const back = `/kb/${slug}`;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(back)}`);
  if (!can(session.role, "article.feedback")) redirect(`${back}?e=vote`);

  const article = await prisma.article.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!article) redirect("/kb");

  const vote = String(formData.get("helpful") ?? "");
  if (vote !== "yes" && vote !== "no") redirect(`${back}?e=vote`);
  const parsed = feedbackComment(String(formData.get("comment") ?? ""));
  if (!parsed.ok) redirect(`${back}?e=comment`);

  const now = await requestTime();
  const latest = await prisma.feedback.findFirst({
    where: { articleId: article.id, userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && feedbackIsCooling(latest.createdAt, now)) redirect(`${back}?e=wait`);

  const helpful = vote === "yes";
  await prisma.$transaction([
    prisma.feedback.create({
      data: {
        articleId: article.id,
        userId: session.userId,
        helpful,
        comment: parsed.comment,
      },
    }),
    prisma.article.update({
      where: { id: article.id },
      data: helpful ? { helpful: { increment: 1 } } : { notHelpful: { increment: 1 } },
    }),
  ]);

  revalidatePath(back);
  revalidatePath("/analytics");
  redirect(`${back}?notice=feedback`);
}
