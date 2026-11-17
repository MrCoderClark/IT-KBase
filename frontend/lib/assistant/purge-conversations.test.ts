import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Pure selection matching the DB query in purge-conversations.ts. Kept
 * testable without a database.
 */
export function selectExpiredConversationIds(input: {
  now: Date;
  retentionDays: number;
  conversations: Array<{ id: string; updatedAt: Date; deletedAt: Date | null }>;
}): string[] {
  const cutoff = new Date(input.now.getTime() - input.retentionDays * 24 * 60 * 60 * 1000);
  return input.conversations
    .filter((row) => row.deletedAt !== null || row.updatedAt < cutoff)
    .map((row) => row.id);
}

describe("selectExpiredConversationIds", () => {
  const now = new Date("2026-11-17T12:00:00Z");

  it("keeps conversations updated inside the retention window", () => {
    const ids = selectExpiredConversationIds({
      now,
      retentionDays: 30,
      conversations: [
        { id: "fresh", updatedAt: new Date("2026-11-10T00:00:00Z"), deletedAt: null },
        { id: "stale", updatedAt: new Date("2026-09-01T00:00:00Z"), deletedAt: null },
      ],
    });
    assert.deepEqual(ids, ["stale"]);
  });

  it("selects soft-deleted rows even if they are still inside the window", () => {
    const ids = selectExpiredConversationIds({
      now,
      retentionDays: 30,
      conversations: [
        { id: "kept", updatedAt: new Date("2026-11-15T00:00:00Z"), deletedAt: null },
        {
          id: "soft",
          updatedAt: new Date("2026-11-16T00:00:00Z"),
          deletedAt: new Date("2026-11-16T00:00:00Z"),
        },
      ],
    });
    assert.deepEqual(ids, ["soft"]);
  });

  it("handles a 1-day minimum retention", () => {
    const ids = selectExpiredConversationIds({
      now,
      retentionDays: 1,
      conversations: [
        { id: "today", updatedAt: new Date("2026-11-17T06:00:00Z"), deletedAt: null },
        { id: "yesterday", updatedAt: new Date("2026-11-16T06:00:00Z"), deletedAt: null },
      ],
    });
    assert.deepEqual(ids, ["yesterday"]);
  });
});
