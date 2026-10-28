import { prisma } from "@/lib/db";

export type NotificationItem = {
  id: string;
  kind: "ingestion_complete" | "review_requested" | "mention";
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const KIND_LABEL: Record<NotificationItem["kind"], string> = {
  ingestion_complete: "Import",
  review_requested: "Review",
  mention: "Mention",
};

export function notificationKindLabel(kind: NotificationItem["kind"]): string {
  return KIND_LABEL[kind];
}

export async function listNotifications(
  userId: string,
  limit = 20,
): Promise<NotificationItem[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}
