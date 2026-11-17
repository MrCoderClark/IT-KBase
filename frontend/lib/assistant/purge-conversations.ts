/**
 * AI Assistant conversation retention (spec 20 §10 Q2, decided 2026-11-17:
 * 30 days, admin-configurable). Hard-deletes:
 *  - any AssistantConversation whose `updatedAt` is older than
 *    `conversationRetentionDays` ago — the user hasn't touched it in the
 *    retention window; and
 *  - any row that's already soft-deleted (`deletedAt` not null) — the user
 *    asked it be gone; no grace window.
 *
 * `AssistantMessage` rows cascade on delete, so no second pass is needed.
 */

import { prisma } from "@/lib/db";
import { readSiteSettings } from "@/lib/settings/store";

export type PurgeExpiredConversationsResult = {
  retentionDays: number;
  cutoff: Date;
  deleted: number;
};

export async function purgeExpiredConversations(
  now = new Date(),
): Promise<PurgeExpiredConversationsResult> {
  const settings = await readSiteSettings();
  const retentionDays = settings.conversationRetentionDays;
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await prisma.assistantConversation.deleteMany({
    where: {
      OR: [{ updatedAt: { lt: cutoff } }, { deletedAt: { not: null } }],
    },
  });

  return { retentionDays, cutoff, deleted: result.count };
}
