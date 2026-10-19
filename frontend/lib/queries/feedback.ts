import { prisma } from "@/lib/db";
import { feedbackIsCooling, feedbackOpenAgain } from "@/lib/kb/feedback";

export type MyFeedback = {
  helpful: boolean;
  comment: string | null;
  openAgain: string;
};

export async function getMyArticleFeedback(
  articleId: string,
  userId: string,
  now: Date,
): Promise<MyFeedback | null> {
  const row = await prisma.feedback.findFirst({
    where: { articleId, userId },
    orderBy: { createdAt: "desc" },
    select: { helpful: true, comment: true, createdAt: true },
  });
  if (!row || !feedbackIsCooling(row.createdAt, now)) return null;
  return {
    helpful: row.helpful,
    comment: row.comment,
    openAgain: feedbackOpenAgain(row.createdAt).toISOString(),
  };
}

export type FeedbackNote = {
  id: string;
  helpful: boolean;
  comment: string | null;
  authorName: string;
  createdAt: string;
  articleTitle?: string;
  articleSlug?: string;
};

export async function listArticleFeedback(articleId: string): Promise<FeedbackNote[]> {
  const rows = await prisma.feedback.findMany({
    where: { articleId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      helpful: true,
      comment: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    helpful: row.helpful,
    comment: row.comment,
    authorName: row.user?.name ?? "Former user",
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listRecentFeedback(): Promise<FeedbackNote[]> {
  const rows = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      helpful: true,
      comment: true,
      createdAt: true,
      user: { select: { name: true } },
      article: { select: { title: true, slug: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    helpful: row.helpful,
    comment: row.comment,
    authorName: row.user?.name ?? "Former user",
    createdAt: row.createdAt.toISOString(),
    articleTitle: row.article.title,
    articleSlug: row.article.slug,
  }));
}
