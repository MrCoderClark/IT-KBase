import type { NotificationKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function createNotification(input: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  articleId?: string | null;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      articleId: input.articleId ?? null,
    },
  });
}

export async function createNotifications(
  rows: Prisma.NotificationCreateManyInput[],
): Promise<void> {
  if (rows.length === 0) return;
  await prisma.notification.createMany({ data: rows });
}

/** Tell every reviewer and admin an article needs a look. Skips the author. */
export async function notifyReviewRequested(input: {
  articleId: string;
  slug: string;
  title: string;
  authorId: string;
  authorName: string;
}): Promise<void> {
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ["reviewer", "admin"] },
      id: { not: input.authorId },
    },
    select: { id: true },
  });
  await createNotifications(
    recipients.map((user) => ({
      userId: user.id,
      kind: "review_requested" as const,
      title: "Review requested",
      body: `${input.authorName} submitted “${input.title}”`,
      href: `/kb/${input.slug}`,
      articleId: input.articleId,
    })),
  );
}
