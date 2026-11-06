/**
 * Conversation history for the assistant (spec 20 §6.2, §7.1). Own-only reads
 * and a soft delete; the retention purge cron (§8) hard-deletes afterwards.
 * Soft-deleted conversations are invisible to every query here.
 */

import { prisma } from "@/lib/db";

export type ConversationSummary = {
  id: string;
  title: string | null;
  scope: "library" | "article";
  articleId: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type ConversationPage = {
  conversations: ConversationSummary[];
  nextCursor: string | null;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: unknown; // Citation[] | null, as stored by ask.ts
  grounded: boolean;
  helpful: boolean | null;
  createdAt: string;
};

export type ConversationDetail = {
  id: string;
  title: string | null;
  scope: "library" | "article";
  articleId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

/** Clamp a requested page size into [1, MAX_LIMIT], defaulting when absent. */
export function clampLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(raw), 1), MAX_LIMIT);
}

/**
 * Split a `take + 1` over-fetch into one page and the next cursor: when more
 * than `take` rows came back, drop the extra and point the cursor at the last
 * kept row's id. Pure so the off-by-one is testable without a database.
 */
export function paginateById<T extends { id: string }>(
  rows: T[],
  take: number,
): { page: T[]; nextCursor: string | null } {
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

/** Own conversations, newest first, cursor-paginated by conversation id. */
export async function listConversations(
  userId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<ConversationPage> {
  const take = clampLimit(opts.limit);
  const rows = await prisma.assistantConversation.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      scope: true,
      articleId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  const { page, nextCursor } = paginateById(rows, take);
  return {
    conversations: page.map((c) => ({
      id: c.id,
      title: c.title,
      scope: c.scope,
      articleId: c.articleId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messageCount: c._count.messages,
    })),
    nextCursor,
  };
}

/** One own conversation with its turns in order, or null if not owned/deleted. */
export async function getConversation(
  userId: string,
  id: string,
): Promise<ConversationDetail | null> {
  const c = await prisma.assistantConversation.findFirst({
    where: { id, userId, deletedAt: null },
    select: {
      id: true,
      title: true,
      scope: true,
      articleId: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          citations: true,
          grounded: true,
          helpful: true,
          createdAt: true,
        },
      },
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    title: c.title,
    scope: c.scope,
    articleId: c.articleId,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    messages: c.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      citations: m.citations ?? null,
      grounded: m.grounded,
      helpful: m.helpful,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

/** Soft-delete an own conversation. Returns false when nothing matched. */
export async function softDeleteConversation(userId: string, id: string): Promise<boolean> {
  const res = await prisma.assistantConversation.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return res.count > 0;
}
